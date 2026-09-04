import assert from "node:assert/strict";
import test from "node:test";
import {
  checkRateLimit,
  clearRateLimitsForTests,
} from "../lib/api-rate-limit.ts";
import {
  findNewEventIds,
  mergeEventIds,
} from "../lib/find-new-event-ids.ts";
import {
  fallbackSearchToken,
  isDirectNameMatch,
  normalizeNameForComparison,
} from "../lib/name-similarity.ts";
import { chunkRows } from "../lib/chunk-rows.ts";
import {
  ConcertFinderApiError,
  createConcertFinderApiClient,
} from "../shared/api/client.ts";
import {
  mapTicketmasterEvent,
  parseUpcomingShowsRequest,
} from "../lib/ticketmaster.ts";

test("event IDs are deduplicated while preserving discovery order", () => {
  assert.deepEqual(
    findNewEventIds(["known", "known"], ["known", "new-1", "new-1", "new-2"]),
    ["new-1", "new-2"],
  );
  assert.deepEqual(mergeEventIds(["one", "two"], ["two", "three"]), [
    "one",
    "two",
    "three",
  ]);
});

test("artist name matching tolerates punctuation and a leading article", () => {
  assert.equal(normalizeNameForComparison("St. Vincent"), "st vincent");
  assert.equal(isDirectNameMatch("National", "The National"), true);
  assert.equal(fallbackSearchToken("The Nationalx"), "national");
});

test("rate limits reset after their fixed window", () => {
  clearRateLimitsForTests();
  const start = 1_000;
  assert.equal(checkRateLimit("test", 2, 500, start).allowed, true);
  assert.equal(checkRateLimit("test", 2, 500, start + 1).allowed, true);
  assert.equal(checkRateLimit("test", 2, 500, start + 2).allowed, false);
  assert.equal(checkRateLimit("test", 2, 500, start + 500).allowed, true);
});

test("notification work is split into bounded concurrency groups", () => {
  assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.throws(() => chunkRows([1], 0), RangeError);
});

test("event searches accept native coordinates, radius, and pagination", () => {
  const parsed = parseUpcomingShowsRequest({
    keyword: "indie rock",
    location: {
      latitude: 37.5407,
      longitude: -77.436,
      radiusMiles: 75,
    },
    page: 2,
    pageSize: 30,
  });

  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.ok ? parsed.location : null, {
    postalCode: "",
    latitude: 37.5407,
    longitude: -77.436,
    radiusMiles: 75,
  });
  assert.equal(parsed.ok ? parsed.page : null, 2);
  assert.equal(parsed.ok ? parsed.pageSize : null, 30);
  assert.equal(
    parseUpcomingShowsRequest({ location: { latitude: 37.5 } }).ok,
    false,
  );
  assert.equal(parseUpcomingShowsRequest({ keyword: "rock", page: 50 }).ok, false);
});

test("Ticketmaster events map to the complete v1 mobile contract", () => {
  const event = mapTicketmasterEvent({
    id: "event-123",
    name: "The National",
    url: "https://www.ticketmaster.com/event-123",
    images: [
      {
        url: "https://example.com/event.jpg",
        ratio: "16_9",
        fallback: false,
      },
    ],
    dates: {
      timezone: "America/New_York",
      status: { code: "onsale" },
      start: {
        dateTime: "2026-10-03T23:30:00Z",
        localDate: "2026-10-03",
        localTime: "19:30:00",
      },
    },
    sales: {
      public: {
        startDateTime: "2026-09-01T14:00:00Z",
        endDateTime: "2026-10-03T22:00:00Z",
      },
    },
    _embedded: {
      attractions: [{ id: "artist-1", name: "The National" }],
      venues: [
        {
          id: "venue-1",
          name: "The Anthem",
          address: { line1: "901 Wharf Street SW" },
          city: { name: "Washington" },
          state: { name: "District of Columbia", stateCode: "DC" },
          postalCode: "20024",
          country: { countryCode: "US" },
          timezone: "America/New_York",
          location: { latitude: "38.8801", longitude: "-77.0262" },
        },
      ],
    },
  });

  assert.ok(event);
  assert.equal(event.startsAt, "2026-10-03T23:30:00Z");
  assert.equal(event.timezone, "America/New_York");
  assert.equal(event.status, "onsale");
  assert.equal(event.ticketUrl, "https://www.ticketmaster.com/event-123");
  assert.equal(event.venue.state, "District of Columbia");
  assert.equal(event.venue.stateCode, "DC");
  assert.equal(event.venue.latitude, 38.8801);
  assert.deepEqual(event.sales, {
    startsAt: "2026-09-01T14:00:00Z",
    endsAt: "2026-10-03T22:00:00Z",
  });
});

test("the shared client uses the versioned mobile API contract", async () => {
  let capturedUrl = "";
  let capturedBody = "";
  const client = createConcertFinderApiClient({
    baseUrl: "https://concert-finder.example/",
    fetchImpl: async (url, init) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body ?? "");
      return Response.json({
        apiVersion: "v1",
        data: {
          events: [],
          page: {
            page: 0,
            pageSize: 20,
            resultCount: 0,
            hasMore: false,
            nextPage: null,
          },
        },
        meta: { requestId: "test-request" },
      });
    },
  });

  const result = await client.searchEvents({
    keyword: "indie rock",
    location: { postalCode: "23220", radiusMiles: 50 },
  });
  assert.equal(
    capturedUrl,
    "https://concert-finder.example/api/v1/ticketmaster/events",
  );
  assert.deepEqual(JSON.parse(capturedBody), {
    keyword: "indie rock",
    location: { postalCode: "23220", radiusMiles: 50 },
  });
  assert.equal(result.page.hasMore, false);
});

test("the shared client exposes stable API errors", async () => {
  const client = createConcertFinderApiClient({
    fetchImpl: async () =>
      Response.json(
        {
          apiVersion: "v1",
          error: { code: "rate_limited", message: "Try again shortly." },
          meta: { requestId: "test-request" },
        },
        { status: 429 },
      ),
  });

  await assert.rejects(
    () => client.searchArtists("Wilco"),
    (error) =>
      error instanceof ConcertFinderApiError &&
      error.status === 429 &&
      error.code === "rate_limited",
  );
});
