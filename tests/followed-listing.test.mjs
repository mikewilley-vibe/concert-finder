import assert from "node:assert/strict";
import test from "node:test";
import {
  eventMatchesFollowedVenue,
  mapTicketmasterEvent,
  MAX_FOLLOWED_LISTING_PAGES,
  searchUpcomingShows,
} from "../lib/ticketmaster.ts";
import {
  firstRouteParam,
} from "../mobile/lib/route-params.ts";
import {
  FOLLOWED_LISTING_PAGE_SIZE,
  loadFollowedListingShows,
  venueShowMatches,
} from "../mobile/lib/followed-listing-shows.ts";

function futureLocalDate(days = 30) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function venueEvent({
  id,
  name = "Show",
  venueId = "KovVenue1",
  venueName = "The Anthem",
  days = 30,
} = {}) {
  const localDate = futureLocalDate(days);
  return {
    id,
    name,
    dates: {
      timezone: "America/New_York",
      status: { code: "onsale" },
      start: {
        dateTime: `${localDate}T23:30:00Z`,
        localDate,
        localTime: "19:30:00",
      },
    },
    _embedded: {
      attractions: [{ id: "artist-1", name: "Artist" }],
      venues: [
        {
          id: venueId,
          name: venueName,
          city: { name: "Washington" },
          state: { name: "District of Columbia", stateCode: "DC" },
        },
      ],
    },
  };
}

function eventPayload(events, { number = 0, totalPages = 1 } = {}) {
  return {
    _embedded: { events },
    page: { number, totalPages },
  };
}

test("route params keep the first non-empty Ticketmaster id", () => {
  assert.equal(firstRouteParam("KovZ917A3Y7"), "KovZ917A3Y7");
  assert.equal(firstRouteParam(["KovZ917A3Y7", "extra"]), "KovZ917A3Y7");
  assert.equal(firstRouteParam(["", "KovZ917A3Y7"]), undefined);
  assert.equal(firstRouteParam("  "), undefined);
});

test("venue name matching accepts aliases without collapsing to the wrong hall", () => {
  assert.equal(
    venueShowMatches(
      { venueId: "KovZpZA7AAEA", venueName: "Madison Square Garden" },
      "Za5ju3rKuqZBgOooTkG_eEQYHIAtk7FC5",
      "Madison Square Garden",
    ),
    true,
  );
  assert.equal(
    venueShowMatches(
      { venueId: "other", venueName: "Red Rocks Amphitheatre" },
      "junk-id",
      "Red Rocks Amp",
    ),
    true,
  );
  assert.equal(
    venueShowMatches(
      { venueId: "other", venueName: "The Forum" },
      "junk-id",
      "Madison Square Garden",
    ),
    false,
  );
  assert.equal(
    eventMatchesFollowedVenue(
      { venue: { id: "KovZ917A3Y7", name: "The Anthem" } },
      { id: "KovZ917A3Y7", label: "The Anthem" },
    ),
    true,
  );
});

test("venue detail keeps every upcoming date instead of the next one only", async () => {
  const calls = [];
  const pages = [
    [
      venueEvent({ id: "show-1", days: 10 }),
      venueEvent({ id: "show-2", days: 20 }),
    ],
    [venueEvent({ id: "show-3", days: 40 })],
  ];

  const result = await loadFollowedListingShows({
    kind: "venue",
    id: "KovVenue1",
    label: "The Anthem",
    search: async (input) => {
      calls.push(input);
      const page = input.page ?? 0;
      return {
        shows: pages[page].map((event) => {
          const mapped = mapTicketmasterEvent(event);
          return {
            id: mapped.id,
            name: mapped.name,
            dateLabel: mapped.dateLabel,
            venueName: mapped.venue.name,
            city: mapped.venue.city ?? "",
            state: mapped.venue.stateCode ?? "",
            venueId: mapped.venue.id,
            attractions: mapped.attractions,
            matchedLabels: ["The Anthem"],
            startsAt: mapped.startsAt,
            localDate: mapped.localDate,
          };
        }),
        page: {
          hasMore: page === 0,
          nextPage: page === 0 ? 1 : null,
        },
      };
    },
  });

  assert.deepEqual(
    result.shows.map((show) => show.id),
    ["show-1", "show-2", "show-3"],
  );
  assert.equal(result.capped, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].pageSize, FOLLOWED_LISTING_PAGE_SIZE);
  assert.deepEqual(calls[0].venues, [{ id: "KovVenue1", label: "The Anthem" }]);
  assert.equal(calls[0].postalCode, undefined);
});

test("empty Ticketmaster venue ids fall back to a name search", async () => {
  const calls = [];
  const result = await loadFollowedListingShows({
    kind: "venue",
    id: "Za5ju3rKuqZBgOooTkG_eEQYHIAtk7FC5",
    label: "Madison Square Garden",
    search: async (input) => {
      calls.push(input);
      if (input.venues?.length) {
        return { shows: [], page: { hasMore: false, nextPage: null } };
      }
      return {
        shows: [
          {
            id: "msg-1",
            name: "Garden show",
            dateLabel: "October 1",
            venueName: "Madison Square Garden",
            city: "New York",
            state: "NY",
            venueId: "KovZpZA7AAEA",
            attractions: [],
            matchedLabels: [],
            startsAt: "2026-10-01T00:00:00Z",
            localDate: "2026-10-01",
          },
          {
            id: "other-1",
            name: "Wrong room",
            dateLabel: "October 2",
            venueName: "The Theater at Madison Square Garden",
            city: "New York",
            state: "NY",
            venueId: "other-venue",
            attractions: [],
            matchedLabels: [],
            startsAt: "2026-10-02T00:00:00Z",
            localDate: "2026-10-02",
          },
        ],
        page: { hasMore: false, nextPage: null },
      };
    },
  });

  assert.deepEqual(
    result.shows.map((show) => show.id),
    ["msg-1"],
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].keyword, "Madison Square Garden");
  assert.deepEqual(calls[1].venues, []);
});

test("artist listing still loads every returned date and does not name-fallback", async () => {
  const calls = [];
  const result = await loadFollowedListingShows({
    kind: "artist",
    id: "artist-1",
    label: "The National",
    search: async (input) => {
      calls.push(input);
      return {
        shows: [
          {
            id: "a-1",
            name: "The National",
            dateLabel: "October 1",
            venueName: "The Anthem",
            city: "Washington",
            state: "DC",
            attractions: [{ id: "artist-1", name: "The National" }],
            matchedLabels: ["The National"],
            startsAt: "2026-10-01T00:00:00Z",
            localDate: "2026-10-01",
          },
          {
            id: "a-2",
            name: "The National",
            dateLabel: "October 8",
            venueName: "The National",
            city: "Richmond",
            state: "VA",
            attractions: [{ id: "artist-1", name: "The National" }],
            matchedLabels: ["The National"],
            startsAt: "2026-10-08T00:00:00Z",
            localDate: "2026-10-08",
          },
        ],
        page: { hasMore: false, nextPage: null },
      };
    },
  });

  assert.deepEqual(
    result.shows.map((show) => show.id),
    ["a-1", "a-2"],
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].attractions, [
    { id: "artist-1", label: "The National" },
  ]);
  assert.deepEqual(calls[0].venues, []);
});

test("venue-only Ticketmaster search collects extra pages and skips home radius", async () => {
  const previousKey = process.env.TICKETMASTER_API_KEY;
  process.env.TICKETMASTER_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  const requested = [];

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url);
    assert.equal(url.searchParams.has("latlong"), false);
    assert.equal(url.searchParams.has("postalCode"), false);
    const page = Number(url.searchParams.get("page") ?? "0");
    const venueId = url.searchParams.get("venueId");
    assert.equal(venueId, "KovVenue1");
    if (page === 0) {
      return Response.json(
        eventPayload(
          [
            venueEvent({ id: "page0-a", days: 8 }),
            venueEvent({ id: "page0-b", days: 9 }),
          ],
          { number: 0, totalPages: 2 },
        ),
      );
    }
    return Response.json(
      eventPayload([venueEvent({ id: "page1-a", days: 12 })], {
        number: 1,
        totalPages: 2,
      }),
    );
  };

  try {
    const result = await searchUpcomingShows({
      attractions: [],
      venues: [{ id: "KovVenue1", label: "The Anthem" }],
      keyword: "",
      location: {
        postalCode: "",
        latitude: null,
        longitude: null,
        radiusMiles: 50,
      },
      page: 0,
      pageSize: 50,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(
        result.shows.map((show) => show.id),
        ["page0-a", "page0-b", "page1-a"],
      );
      assert.equal(result.page.hasMore, false);
    }
    assert.equal(requested.length, 2);
    assert.ok(requested.length <= MAX_FOLLOWED_LISTING_PAGES);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) {
      delete process.env.TICKETMASTER_API_KEY;
    } else {
      process.env.TICKETMASTER_API_KEY = previousKey;
    }
  }
});

test("empty venueId searches retry by venue name and keep matching dates", async () => {
  const previousKey = process.env.TICKETMASTER_API_KEY;
  process.env.TICKETMASTER_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  const requested = [];

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url);
    if (url.searchParams.get("venueId")) {
      return Response.json(eventPayload([]));
    }
    assert.equal(url.searchParams.get("keyword"), "Madison Square Garden");
    return Response.json(
      eventPayload([
        venueEvent({
          id: "msg-keep",
          venueId: "KovZpZA7AAEA",
          venueName: "Madison Square Garden",
          days: 14,
        }),
        venueEvent({
          id: "msg-drop",
          venueId: "other",
          venueName: "Barclays Center",
          days: 15,
        }),
      ]),
    );
  };

  try {
    const result = await searchUpcomingShows({
      attractions: [],
      venues: [
        {
          id: "Za5ju3rKuqZBgOooTkG_eEQYHIAtk7FC5",
          label: "Madison Square Garden",
        },
      ],
      keyword: "",
      location: {
        postalCode: "",
        latitude: null,
        longitude: null,
        radiusMiles: 50,
      },
      page: 0,
      pageSize: 50,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(
        result.shows.map((show) => show.id),
        ["msg-keep"],
      );
    }
    assert.equal(
      requested.some((url) => url.searchParams.get("keyword")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) {
      delete process.env.TICKETMASTER_API_KEY;
    } else {
      process.env.TICKETMASTER_API_KEY = previousKey;
    }
  }
});
