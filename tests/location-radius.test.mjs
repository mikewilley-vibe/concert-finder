import assert from "node:assert/strict";
import test from "node:test";
import {
  distanceMiles,
  filterShowsByRadius,
  parseZippopotamPlaces,
  postalGeocodeUrl,
  ticketmasterLocationParams,
} from "../lib/geo.ts";
import {
  mapTicketmasterEvent,
  searchUpcomingShows,
} from "../lib/ticketmaster.ts";

const NORFOLK = { latitude: 36.9168, longitude: -76.2875 };
const RICHMOND = { latitude: 37.5411, longitude: -77.434601 };
const LOS_ANGELES = { latitude: 34.0522, longitude: -118.2437 };

function futureLocalDate(days = 30) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function eventPayload(events) {
  return {
    _embedded: { events },
    page: { number: 0, totalPages: 1 },
  };
}

function irishRoverEvent(overrides = {}) {
  const localDate = futureLocalDate();
  return {
    id: "Z7r9jZ1A7J3Q3",
    name: "One Irish Rover",
    url: "https://www.ticketmaster.com/event/Z7r9jZ1A7J3Q3",
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
      attractions: [{ id: "Z7r9jZa4W_", name: "One Irish Rover" }],
      venues: [
        {
          id: "KovZpa2nke",
          name: "The National",
          city: { name: "Richmond" },
          state: { name: "Virginia", stateCode: "VA" },
          postalCode: "23219",
          country: { countryCode: "US" },
          location: {
            latitude: String(RICHMOND.latitude),
            longitude: String(RICHMOND.longitude),
          },
        },
      ],
    },
    ...overrides,
  };
}

function losAngelesEvent() {
  const localDate = futureLocalDate(40);
  const event = irishRoverEvent();
  event.id = "far-west-1";
  event.name = "One Irish Rover West";
  event.dates.start.localDate = localDate;
  event.dates.start.dateTime = `${localDate}T03:00:00Z`;
  event._embedded.venues[0] = {
    id: "la-venue",
    name: "The Forum",
    city: { name: "Inglewood" },
    state: { name: "California", stateCode: "CA" },
    postalCode: "90301",
    country: { countryCode: "US" },
    location: {
      latitude: String(LOS_ANGELES.latitude),
      longitude: String(LOS_ANGELES.longitude),
    },
  };
  return event;
}

test("Norfolk to Richmond is inside 250 miles and outside 25", () => {
  const miles = distanceMiles(NORFOLK, RICHMOND);
  assert.ok(miles > 70 && miles < 110, `expected ~90 miles, got ${miles}`);
  assert.deepEqual(
    filterShowsByRadius(
      [
        {
          id: "richmond",
          venue: { latitude: RICHMOND.latitude, longitude: RICHMOND.longitude },
        },
        {
          id: "la",
          venue: {
            latitude: LOS_ANGELES.latitude,
            longitude: LOS_ANGELES.longitude,
          },
        },
        { id: "unknown", venue: { latitude: null, longitude: null } },
      ],
      { ...NORFOLK, radiusMiles: 250 },
    ).map((show) => show.id),
    ["richmond", "unknown"],
  );
  assert.deepEqual(
    filterShowsByRadius(
      [
        {
          id: "richmond",
          venue: { latitude: RICHMOND.latitude, longitude: RICHMOND.longitude },
        },
      ],
      { ...NORFOLK, radiusMiles: 25 },
    ),
    [],
  );
});

test("Ticketmaster location params use latlong and never postalCode", () => {
  assert.deepEqual(ticketmasterLocationParams(null), {});
  assert.deepEqual(
    ticketmasterLocationParams({ ...NORFOLK, radiusMiles: 250 }),
    {
      latlong: "36.9168,-76.2875",
      radius: "250",
      unit: "miles",
    },
  );
  assert.equal(
    Object.hasOwn(
      ticketmasterLocationParams({ ...NORFOLK, radiusMiles: 50 }),
      "postalCode",
    ),
    false,
  );
});

test("Zippopotam URLs and payloads resolve US home zips", () => {
  assert.equal(postalGeocodeUrl("23505"), "https://api.zippopotam.us/us/23505");
  assert.equal(
    postalGeocodeUrl("K1A 0B1"),
    "https://api.zippopotam.us/ca/K1A",
  );
  assert.equal(postalGeocodeUrl("!!"), null);
  assert.deepEqual(
    parseZippopotamPlaces({
      places: [{ latitude: "36.9168", longitude: "-76.2875" }],
    }),
    NORFOLK,
  );
});

test("mapped Richmond venue stays within a 250-mile postal radius filter", () => {
  const show = mapTicketmasterEvent(irishRoverEvent());
  assert.ok(show);
  assert.equal(show.venue.postalCode, "23219");
  const kept = filterShowsByRadius([show], { ...NORFOLK, radiusMiles: 250 });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, "Z7r9jZ1A7J3Q3");
  assert.equal(
    filterShowsByRadius([show], { ...NORFOLK, radiusMiles: 25 }).length,
    0,
  );
});

test("postal follow search geocodes the zip and does not send TM postalCode", async () => {
  const previousKey = process.env.TICKETMASTER_API_KEY;
  process.env.TICKETMASTER_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;
  const requested = [];

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requested.push(url);
    if (url.hostname === "api.zippopotam.us") {
      return Response.json({
        places: [{ latitude: "36.9168", longitude: "-76.2875" }],
      });
    }
    if (url.pathname.endsWith("/discovery/v2/events.json")) {
      assert.equal(url.searchParams.has("postalCode"), false);
      if (url.searchParams.has("latlong")) {
        assert.equal(url.searchParams.get("latlong"), "36.9168,-76.2875");
        assert.equal(url.searchParams.get("radius"), "250");
        return Response.json(eventPayload([irishRoverEvent()]));
      }
      return Response.json(eventPayload([]));
    }
    throw new Error(`Unexpected fetch ${url.href}`);
  };

  try {
    const result = await searchUpcomingShows({
      attractions: [{ id: "Z7r9jZa4W_", label: "One Irish Rover" }],
      venues: [],
      keyword: "",
      location: {
        postalCode: "23505",
        latitude: null,
        longitude: null,
        radiusMiles: 250,
      },
      page: 0,
      pageSize: 20,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.shows.length, 1);
      assert.equal(result.shows[0].id, "Z7r9jZ1A7J3Q3");
      assert.equal(result.shows[0].venue.city, "Richmond");
    }
    assert.equal(
      requested.some((url) => url.hostname === "api.zippopotam.us"),
      true,
    );
    assert.equal(
      requested.some((url) => url.searchParams.has("postalCode")),
      false,
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

test("followed events TM cannot geo-filter still appear when locally nearby", async () => {
  const previousKey = process.env.TICKETMASTER_API_KEY;
  process.env.TICKETMASTER_API_KEY = "test-key";
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.zippopotam.us") {
      return Response.json({
        places: [{ latitude: "36.9168", longitude: "-76.2875" }],
      });
    }
    if (url.pathname.endsWith("/discovery/v2/events.json")) {
      if (url.searchParams.has("latlong")) {
        return Response.json(eventPayload([]));
      }
      return Response.json(eventPayload([irishRoverEvent(), losAngelesEvent()]));
    }
    throw new Error(`Unexpected fetch ${url.href}`);
  };

  try {
    const result = await searchUpcomingShows({
      attractions: [{ id: "Z7r9jZa4W_", label: "One Irish Rover" }],
      venues: [],
      keyword: "",
      location: {
        postalCode: "23505",
        latitude: null,
        longitude: null,
        radiusMiles: 250,
      },
      page: 0,
      pageSize: 20,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(
        result.shows.map((show) => show.id),
        ["Z7r9jZ1A7J3Q3"],
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) {
      delete process.env.TICKETMASTER_API_KEY;
    } else {
      process.env.TICKETMASTER_API_KEY = previousKey;
    }
  }
});
