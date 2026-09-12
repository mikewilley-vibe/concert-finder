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
import { resolveSupabaseAdminConfig } from "../lib/supabase/admin-client.ts";
import { completeEmailDomain } from "../mobile/lib/email-domains.ts";
import {
  homeLocationLabel,
  parsePostalCode,
  parseStoredHomeLocation,
  upcomingSearchFields,
} from "../mobile/lib/home-location.ts";
import {
  artistDeepLink,
  concertDeepLink,
  concertShareText,
} from "../mobile/lib/share-copy.ts";
import { calendarWindow } from "../mobile/lib/calendar-window.ts";
import { pickNextUpcomingShows } from "../mobile/lib/next-upcoming-shows.ts";
import { newShowPushCopy } from "../lib/push-copy.ts";

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

test("account deletion requires an authenticated explicit DELETE request", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedAuthorization = "";
  let capturedConfirmation = "";
  let capturedBody = "";
  const client = createConcertFinderApiClient({
    baseUrl: "https://concert-finder.example",
    fetchImpl: async (url, init) => {
      capturedUrl = String(url);
      capturedMethod = String(init?.method ?? "");
      const headers = new Headers(init?.headers);
      capturedAuthorization = headers.get("authorization") ?? "";
      capturedConfirmation = headers.get("x-confirm-account-delete") ?? "";
      capturedBody = String(init?.body ?? "");
      return Response.json({
        apiVersion: "v1",
        data: { deleted: true },
        meta: { requestId: "test-request" },
      });
    },
  });

  const result = await client.deleteAccount("access-token");
  assert.equal(capturedUrl, "https://concert-finder.example/api/v1/account/delete");
  assert.equal(capturedMethod, "POST");
  assert.equal(capturedAuthorization, "Bearer access-token");
  assert.equal(capturedConfirmation, "DELETE");
  assert.deepEqual(JSON.parse(capturedBody), { confirmation: "DELETE" });
  assert.equal(result.deleted, true);
});

test("server admin config accepts Supabase integration variable names", () => {
  assert.deepEqual(
    resolveSupabaseAdminConfig({
      SUPABASE_URL: " https://development.supabase.co ",
      SUPABASE_SERVICE_ROLE_KEY: "eyJheader.payload.signature",
    }),
    {
      url: "https://development.supabase.co",
      secretKey: "eyJheader.payload.signature",
    },
  );

  assert.deepEqual(
    resolveSupabaseAdminConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://development.supabase.co",
      SUPABASE_SECRET_KEY: "not-a-secret-key",
      SUPABASE_SERVICE_ROLE_KEY: "eyJheader.payload.signature",
    }),
    {
      url: "https://development.supabase.co",
      secretKey: "eyJheader.payload.signature",
    },
  );
});

test("email domain shortcuts preserve the typed mailbox", () => {
  assert.equal(completeEmailDomain("mike", "gmail.com"), "mike@gmail.com");
  assert.equal(
    completeEmailDomain(" mike@gm ", "yahoo.com"),
    "mike@yahoo.com",
  );
  assert.equal(completeEmailDomain("", "outlook.com"), "");
});

test("home location postal codes match the Ticketmaster search rules", () => {
  assert.deepEqual(parsePostalCode(" 20003 "), { ok: true, postalCode: "20003" });
  assert.equal(parsePostalCode("!!").ok, false);
  assert.equal(
    homeLocationLabel({
      postalCode: "20003",
      radiusMiles: 50,
      latitude: null,
      longitude: null,
    }),
    "Within 50 miles of 20003.",
  );
  assert.equal(
    homeLocationLabel({
      postalCode: "20003",
      radiusMiles: 25,
      latitude: 38.89,
      longitude: -77.03,
    }),
    "Within 25 miles of your current location (20003).",
  );
  assert.equal(
    parseStoredHomeLocation('{"postalCode":"23220","radiusMiles":100}').radiusMiles,
    100,
  );
  assert.deepEqual(
    parseStoredHomeLocation(
      '{"postalCode":"20003","radiusMiles":50,"latitude":38.9,"longitude":-77.04}',
    ),
    {
      postalCode: "20003",
      radiusMiles: 50,
      latitude: 38.9,
      longitude: -77.04,
    },
  );
  assert.deepEqual(
    upcomingSearchFields({
      postalCode: "20003",
      radiusMiles: 50,
      latitude: 38.9,
      longitude: -77.04,
    }),
    { latitude: 38.9, longitude: -77.04, radiusMiles: 50 },
  );
  assert.deepEqual(
    upcomingSearchFields({
      postalCode: "20003",
      radiusMiles: 50,
      latitude: null,
      longitude: null,
    }),
    { postalCode: "20003", radiusMiles: 50 },
  );
});

test("Home upcoming follows keep only the next date per artist and venue", () => {
  const show = (id, startsAt, extras = {}) => ({
    id,
    startsAt,
    localDate: startsAt.slice(0, 10),
    attractions: [],
    ...extras,
  });

  const artistASoon = show("a-soon", "2026-10-01T00:00:00Z", {
    attractions: [{ id: "artist-a" }],
    venueId: "other-venue",
  });
  const artistALater = show("a-later", "2026-11-01T00:00:00Z", {
    attractions: [{ id: "artist-a" }],
    venueId: "other-venue",
  });
  const artistBSoon = show("b-soon", "2026-10-05T00:00:00Z", {
    attractions: [{ id: "artist-b" }],
  });
  const artistBLater = show("b-later", "2026-10-20T00:00:00Z", {
    attractions: [{ id: "artist-b" }],
  });
  const venueSoon = show("v-soon", "2026-10-03T00:00:00Z", {
    attractions: [{ id: "someone-else" }],
    venueId: "venue-v",
  });
  const venueLater = show("v-later", "2026-10-10T00:00:00Z", {
    attractions: [{ id: "someone-else" }],
    venueId: "venue-v",
  });
  const outOfFollows = show("other", "2026-09-20T00:00:00Z", {
    attractions: [{ id: "artist-c" }],
    venueId: "venue-other",
  });

  assert.deepEqual(
    pickNextUpcomingShows(
      [
        artistALater,
        venueLater,
        artistBLater,
        artistBSoon,
        venueSoon,
        artistASoon,
        outOfFollows,
      ],
      {
        attractionIds: ["artist-a", "artist-b"],
        venueIds: ["venue-v"],
      },
    ).map((item) => item.id),
    ["a-soon", "v-soon", "b-soon"],
  );
  assert.deepEqual(
    pickNextUpcomingShows([artistASoon, artistALater], {
      attractionIds: ["artist-missing"],
      venueIds: [],
    }),
    [],
  );
});

test("Ticketmaster-mapped venue ids collapse to the next in-range date", () => {
  const mappedEvent = (id, localDate, attractionId, venueId) => {
    const event = mapTicketmasterEvent({
      id,
      name: "Mapped show",
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
        attractions: [{ id: attractionId, name: "Mapped artist" }],
        venues: [
          {
            id: venueId,
            name: "The Anthem",
            city: { name: "Washington" },
            state: { name: "District of Columbia", stateCode: "DC" },
          },
        ],
      },
    });
    assert.ok(event);
    return {
      id: event.id,
      startsAt: event.startsAt,
      localDate: event.localDate,
      venueId: event.venue.id,
      attractions: event.attractions,
    };
  };

  const next = mappedEvent("venue-next", "2026-10-04", "artist-a", "venue-1");
  const later = mappedEvent("venue-later", "2026-10-18", "artist-a", "venue-1");
  const otherVenue = mappedEvent("other-venue", "2026-10-02", "artist-a", "venue-2");

  assert.equal(next.venueId, "venue-1");
  assert.deepEqual(
    pickNextUpcomingShows([later, otherVenue, next], {
      attractionIds: [],
      venueIds: ["venue-1"],
    }).map((item) => item.id),
    ["venue-next"],
  );
});

test("a shared next date for a followed artist and venue is listed once", () => {
  const shared = {
    id: "shared-next",
    startsAt: "2026-10-02T00:00:00Z",
    localDate: "2026-10-02",
    venueId: "venue-v",
    attractions: [{ id: "artist-a" }],
  };
  const laterArtist = {
    id: "later-artist",
    startsAt: "2026-10-15T00:00:00Z",
    localDate: "2026-10-15",
    venueId: "other-venue",
    attractions: [{ id: "artist-a" }],
  };
  const laterVenue = {
    id: "later-venue",
    startsAt: "2026-10-08T00:00:00Z",
    localDate: "2026-10-08",
    venueId: "venue-v",
    attractions: [{ id: "someone-else" }],
  };

  assert.deepEqual(
    pickNextUpcomingShows([laterVenue, laterArtist, shared], {
      attractionIds: ["artist-a"],
      venueIds: ["venue-v"],
    }).map((item) => item.id),
    ["shared-next"],
  );
});

test("concert share copy uses an https open link", () => {
  const origin = "https://concert-finder-eta.vercel.app";
  assert.equal(concertDeepLink("1AvZZbkGkFkgjd"), "showsignal://concert/1AvZZbkGkFkgjd");
  assert.equal(
    artistDeepLink("K8vZ9171J7f", "Phish"),
    "showsignal://artist/K8vZ9171J7f?name=Phish",
  );
  assert.equal(
    concertShareText(
      {
        id: "1AvZZbkGkFkgjd",
        name: "Phish",
        dateLabel: "December 30",
        timeLabel: "7:30 PM",
        venueName: "Madison Square Garden",
        city: "New York",
        state: "NY",
        url: "https://www.ticketmaster.com/event/1AvZZbkGkFkgjd",
        attractions: [],
        matchedLabels: [],
      },
      origin,
    ),
    [
      "Phish",
      "December 30 · 7:30 PM",
      "Madison Square Garden · New York, NY",
      "https://concert-finder-eta.vercel.app/open/concert/1AvZZbkGkFkgjd?name=Phish",
    ].join("\n"),
  );
});

test("calendar windows prefer an exact start time and last three hours", () => {
  const timed = calendarWindow({
    localDate: "2026-12-30",
    localTime: "19:30:00",
  });
  assert.equal(timed.ok, true);
  if (timed.ok) {
    assert.equal(timed.allDay, false);
    assert.equal(timed.start.getHours(), 19);
    assert.equal(timed.start.getMinutes(), 30);
    assert.equal(timed.end.getTime() - timed.start.getTime(), 3 * 60 * 60 * 1000);
  }
  assert.equal(calendarWindow({}).ok, false);
});

test("new-show push copy names the follow and the number of dates", () => {
  assert.deepEqual(
    newShowPushCopy({
      itemType: "ticketmaster_attraction",
      itemLabel: "Phish",
      count: 1,
    }),
    {
      title: "New Phish date",
      body: "Open ShowSignal to see them on Home.",
    },
  );
  assert.equal(
    newShowPushCopy({
      itemType: "ticketmaster_venue",
      itemLabel: "Madison Square Garden",
      count: 3,
    }).title,
    "3 new dates at Madison Square Garden",
  );
});

test("follow errors keep auth, RLS, and network causes visible", async () => {
  const { followsMessage } = await import("../mobile/lib/account.ts");
  const { followPendingKey } = await import("../mobile/lib/follow-result.ts");

  assert.equal(
    followsMessage({ message: "Network request failed", code: "", status: 0 }),
    "Network error. Check your connection and try Follow again.",
  );
  assert.equal(
    followsMessage({
      message: "new row violates row-level security policy",
      code: "42501",
      status: 403,
    }),
    "ShowSignal could not save that follow because of a permissions (RLS) rule. Confirm you are signed in as the same user and try again.",
  );
  assert.equal(
    followsMessage({
      message: "JWT expired",
      code: "PGRST301",
      status: 401,
    }),
    "Your session is not signed in or has expired. Reopen ShowSignal and try again.",
  );
  assert.equal(
    followsMessage({ message: "duplicate key value", code: "23505", status: 409 }),
    "duplicate key value",
  );
  assert.equal(
    followPendingKey("ticketmaster_attraction", "K8vZ9171J7f"),
    "ticketmaster_attraction:K8vZ9171J7f",
  );
});

test("related suggestions rank real Ticketmaster IDs and hide empty genre seeds", async () => {
  const { rankRelatedSuggestions, parseRecommendationsRequest } = await import(
    "../lib/recommendations.ts"
  );
  const { rememberDiscoverySeed, parseDiscoverySeeds, DISCOVERY_SEEDS_STORAGE_KEY } =
    await import("../mobile/lib/discovery-seeds.ts");
  const { readArtistClassification } = await import("../lib/ticketmaster.ts");

  assert.equal(DISCOVERY_SEEDS_STORAGE_KEY, "showsignal:v1:discovery-seeds");
  assert.deepEqual(
    rankRelatedSuggestions({
      seed: {
        id: "seed-1",
        label: "Phish",
        genreId: null,
        genreName: null,
        subGenreId: null,
        subGenreName: null,
      },
      excludeAttractionIds: [],
      excludeVenueIds: [],
      events: [
        {
          attractionId: "other-1",
          attractionName: "Other",
          attractionGenreId: "g1",
          attractionSubGenreId: null,
          venueId: "v1",
          venueName: "Room",
          venueCity: "Boston",
          venueState: "MA",
          startsAt: "2026-10-01T00:00:00Z",
          nearLocation: true,
        },
      ],
    }),
    { seedLabel: null, artists: [], venues: [] },
  );

  const ranked = rankRelatedSuggestions({
    seed: {
      id: "seed-1",
      label: "Phish",
      genreId: "g1",
      genreName: "Rock",
      subGenreId: "sg1",
      subGenreName: "Jam",
    },
    excludeAttractionIds: ["followed-1"],
    excludeVenueIds: ["followed-v"],
    events: [
      {
        attractionId: "seed-1",
        attractionName: "Phish",
        attractionGenreId: "g1",
        attractionSubGenreId: "sg1",
        venueId: "v-keep",
        venueName: "Garden",
        venueCity: "Boston",
        venueState: "MA",
        startsAt: "2026-10-01T00:00:00Z",
        nearLocation: true,
      },
      {
        attractionId: "followed-1",
        attractionName: "Already",
        attractionGenreId: "g1",
        attractionSubGenreId: "sg1",
        venueId: "v-keep",
        venueName: "Garden",
        venueCity: "Boston",
        venueState: "MA",
        startsAt: "2026-10-02T00:00:00Z",
        nearLocation: true,
      },
      {
        attractionId: "peer-1",
        attractionName: "Peer",
        attractionGenreId: "g1",
        attractionSubGenreId: "sg1",
        venueId: "followed-v",
        venueName: "Skip me",
        venueCity: "NYC",
        venueState: "NY",
        startsAt: "2026-10-03T00:00:00Z",
        nearLocation: false,
      },
      {
        attractionId: "peer-1",
        attractionName: "Peer",
        attractionGenreId: "g1",
        attractionSubGenreId: "sg1",
        venueId: "v-keep",
        venueName: "Garden",
        venueCity: "Boston",
        venueState: "MA",
        startsAt: "2026-10-04T00:00:00Z",
        nearLocation: true,
      },
    ],
  });
  assert.equal(ranked.seedLabel, "Phish");
  assert.deepEqual(
    ranked.artists.map((item) => item.id),
    ["peer-1"],
  );
  assert.deepEqual(
    ranked.venues.map((item) => item.id),
    ["v-keep"],
  );

  const parsed = parseRecommendationsRequest({
    seeds: [{ id: "ab12", label: "X" }],
  });
  assert.equal(parsed.ok && parsed.value.seed, null);

  const classification = readArtistClassification({
    classifications: [
      {
        primary: true,
        genre: { id: "g1", name: "Rock" },
        subGenre: { id: "sg1", name: "Jam" },
      },
    ],
  });
  assert.equal(classification.genreId, "g1");
  assert.equal(classification.subGenreName, "Jam");

  let seeds = [];
  for (let index = 0; index < 12; index += 1) {
    seeds = rememberDiscoverySeed(seeds, {
      id: `id-${index}xxxx`,
      label: `Artist ${index}`,
      genreId: "g1",
      genreName: "Rock",
      subGenreId: null,
      subGenreName: null,
      source: "search",
      savedAt: index,
    });
  }
  assert.equal(seeds.length, 10);
  assert.equal(parseDiscoverySeeds("not-json").length, 0);
});

test("auth callback URLs parse tokens and rebuild the ShowSignal scheme", async () => {
  const {
    AUTH_ASSOCIATION,
    authCallbackErrorMessage,
    authCallbackSuccessMessage,
    hasAuthPayload,
    isAuthCallbackUrl,
    isMobileUserAgent,
    parseAuthCallback,
    toAppAuthCallbackUrl,
  } = await import("../shared/auth-callback.ts");
  const { appleAppSiteAssociation, androidAssetLinks } = await import(
    "../lib/app-association.ts"
  );

  const httpsUrl =
    "https://concert-finder-eta.vercel.app/auth/callback?code=abc123&type=signup";
  const hashUrl =
    "https://concert-finder-eta.vercel.app/auth/callback#access_token=tok&refresh_token=ref&type=recovery";
  const schemeUrl = "showsignal://auth/callback?token_hash=otp&type=email_change";

  assert.equal(isAuthCallbackUrl(httpsUrl), true);
  assert.equal(isAuthCallbackUrl(schemeUrl), true);
  assert.equal(isAuthCallbackUrl("https://concert-finder-eta.vercel.app/account"), false);
  assert.equal(parseAuthCallback(httpsUrl).code, "abc123");
  assert.equal(parseAuthCallback(hashUrl).accessToken, "tok");
  assert.equal(parseAuthCallback(schemeUrl).tokenHash, "otp");
  assert.equal(hasAuthPayload(parseAuthCallback(httpsUrl)), true);
  assert.equal(
    toAppAuthCallbackUrl(httpsUrl),
    "showsignal://auth/callback?code=abc123&type=signup",
  );
  assert.equal(
    toAppAuthCallbackUrl(hashUrl),
    "showsignal://auth/callback?type=recovery&access_token=tok&refresh_token=ref",
  );
  assert.equal(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)"), true);
  assert.equal(isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X)"), false);
  assert.equal(authCallbackSuccessMessage("recovery"), "Reset link accepted. Set a new password.");
  assert.match(authCallbackErrorMessage("otp_expired"), /expired or invalid/);
  assert.equal(
    AUTH_ASSOCIATION.appleTeamId + "." + AUTH_ASSOCIATION.bundleId,
    "896999WP34.com.mikewilley.localshows",
  );
  assert.equal(
    appleAppSiteAssociation().applinks.details[0].appIDs[0],
    "896999WP34.com.mikewilley.localshows",
  );
  assert.deepEqual(androidAssetLinks([]), []);
  assert.equal(
    androidAssetLinks(["AA:BB"])[0].target.package_name,
    "com.mikewilley.localshows",
  );
});
