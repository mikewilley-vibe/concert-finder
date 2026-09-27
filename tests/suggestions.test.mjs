import assert from "node:assert/strict";
import test from "node:test";

import {
  clearLastFmSimilarCache,
  getSimilarArtists,
  parseLastFmSimilar,
} from "../lib/lastfm.ts";
import {
  loadSuggestionPills,
  parseSuggestionRequest,
} from "../lib/suggestion-feed.ts";
import {
  buildSuggestionPills,
  mergeSimilarArtists,
} from "../lib/suggestion-pills.ts";

const NOW = new Date("2026-09-27T15:00:00Z");

function show({
  id,
  date,
  city = "Norfolk",
  venueId,
  venueName,
  artists,
}) {
  return {
    id,
    localDate: date,
    city,
    state: "VA",
    venueId,
    venueName,
    attractions: artists,
  };
}

const nearbyShows = [
  show({
    id: "e1",
    date: "2026-10-12",
    venueId: "norva",
    venueName: "The Norva",
    artists: [{ id: "phoebe", name: "Phoebe Bridgers", imageUrl: null }],
  }),
  show({
    id: "e2",
    date: "2026-10-20",
    venueId: "norva",
    venueName: "The Norva",
    artists: [{ id: "thief", name: "Big Thief", imageUrl: null }],
  }),
  show({
    id: "e3",
    date: "2026-10-03",
    venueId: "norva",
    venueName: "The Norva",
    artists: [{ id: "thief", name: "Big Thief", imageUrl: null }],
  }),
  show({
    id: "e4",
    date: "2026-11-15",
    venueId: "boathouse",
    venueName: "The NorVa Boathouse",
    artists: [{ id: "later", name: "Later Only", imageUrl: null }],
  }),
];

test("similar artists are weighted by match score and how many follows point at them", () => {
  const merged = mergeSimilarArtists([
    {
      seedName: "Hozier",
      artists: [
        { name: "Phoebe Bridgers", match: 0.4 },
        { name: "Big Thief", match: 0.95 },
      ],
    },
    {
      seedName: "Adrianne Lenker",
      artists: [{ name: "Phoebe Bridgers", match: 0.4 }],
    },
  ]);
  assert.equal(merged[0].name, "Phoebe Bridgers");
  assert.equal(merged[0].seedCount, 2);
  assert.ok(merged[0].score > merged[1].score);
});

test("artist pills require a nearby show and keep a real reason", () => {
  const pills = buildSuggestionPills({
    now: NOW,
    follows: {
      artists: [{ id: "hozier", name: "Hozier" }],
      venues: [],
    },
    dismissed: { artists: [], venues: [] },
    similar: [
      {
        seedName: "Hozier",
        artists: [
          { name: "Phoebe Bridgers", match: 0.8 },
          { name: "Nobody Nearby", match: 0.99 },
        ],
      },
    ],
    activity: {
      artists: [{ id: "thief", name: "Big Thief", signal: "going" }],
      venues: [],
    },
    shows: nearbyShows,
  });

  assert.deepEqual(
    pills.artists.map((pill) => ({ name: pill.name, reason: pill.reason, source: pill.source })),
    [
      {
        name: "Phoebe Bridgers",
        reason: "Like Hozier · Norfolk Oct 12",
        source: "similar",
      },
      {
        name: "Big Thief",
        reason: "You're going · Norfolk Oct 3",
        source: "activity",
      },
      {
        name: "Later Only",
        reason: "Norfolk · Nov 15",
        source: "nearby",
      },
    ],
  );
  assert.equal(
    pills.venues[0]?.reason,
    "Hosts 3 shows this month",
  );
  assert.equal(pills.venues.some((pill) => pill.name === "The NorVa Boathouse"), false);
});

test("followed and dismissed artists and venues never come back", () => {
  const pills = buildSuggestionPills({
    now: NOW,
    follows: {
      artists: [{ id: "phoebe", name: "Phoebe Bridgers" }],
      venues: [{ id: "norva", name: "The Norva" }],
    },
    dismissed: {
      artists: [{ id: "thief", name: "Big Thief" }],
      venues: [],
    },
    similar: [
      {
        seedName: "Hozier",
        artists: [
          { name: "Phoebe Bridgers", match: 0.9 },
          { name: "Big Thief", match: 0.8 },
        ],
      },
    ],
    activity: { artists: [], venues: [] },
    shows: [
      ...nearbyShows,
      show({
        id: "e5",
        date: "2026-10-12",
        venueId: "national",
        venueName: "The National",
        artists: [{ id: "phoebe", name: "Phoebe Bridgers", imageUrl: null }],
      }),
    ],
  });

  assert.equal(
    pills.artists.some((pill) => pill.name === "Phoebe Bridgers" || pill.name === "Big Thief"),
    false,
  );
  assert.equal(pills.venues.some((pill) => pill.name === "The Norva"), false);
  assert.equal(pills.venues[0]?.name, "The National");
  assert.equal(pills.venues[0]?.reason, "Phoebe Bridgers plays here Oct 12");
});

test("cold start uses nearby artists and the busiest venues", () => {
  const pills = buildSuggestionPills({
    now: NOW,
    follows: { artists: [], venues: [] },
    dismissed: { artists: [], venues: [] },
    similar: [],
    activity: { artists: [], venues: [] },
    shows: nearbyShows,
  });
  assert.equal(pills.artists[0]?.name, "Big Thief");
  assert.equal(pills.artists[0]?.source, "nearby");
  assert.equal(pills.venues[0]?.name, "The Norva");
  assert.match(pills.venues[0]?.reason ?? "", /Hosts 3 shows this month/);
});

test("suggestion pills stop at 12", () => {
  const shows = Array.from({ length: 15 }, (_, index) =>
    show({
      id: `e${index}`,
      date: "2026-10-12",
      venueId: `v${index}`,
      venueName: `Room ${index}`,
      artists: [{ id: `a${index}`, name: `Artist ${index}`, imageUrl: null }],
    }),
  );
  const pills = buildSuggestionPills({
    now: NOW,
    follows: { artists: [], venues: [] },
    dismissed: { artists: [], venues: [] },
    similar: [],
    activity: { artists: [], venues: [] },
    shows,
  });
  assert.equal(pills.artists.length, 12);
  assert.equal(pills.venues.length, 12);
});

test("missing Last.fm key skips the request", async () => {
  clearLastFmSimilarCache();
  const previous = process.env.LASTFM_API_KEY;
  delete process.env.LASTFM_API_KEY;
  let calls = 0;
  const result = await getSimilarArtists("Hozier", async () => {
    calls += 1;
    throw new Error("should not fetch");
  });
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(calls, 0);
  if (previous === undefined) {
    delete process.env.LASTFM_API_KEY;
  } else {
    process.env.LASTFM_API_KEY = previous;
  }
});

test("Last.fm responses are parsed, cached, and failures stay empty", async () => {
  clearLastFmSimilarCache();
  const previous = process.env.LASTFM_API_KEY;
  process.env.LASTFM_API_KEY = "test-key";
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      async json() {
        return {
          similarartists: {
            artist: [
              { name: "Phoebe Bridgers", match: "0.81" },
              { name: "", match: "1" },
            ],
          },
        };
      },
    };
  };
  const first = await getSimilarArtists("Hozier", fetchImpl);
  const second = await getSimilarArtists("Hozier", fetchImpl);
  assert.equal(calls, 1);
  assert.deepEqual(first.artists, [{ name: "Phoebe Bridgers", match: 0.81 }]);
  assert.deepEqual(second.artists, first.artists);

  clearLastFmSimilarCache();
  const failed = await getSimilarArtists("Hozier", async () => ({
    ok: false,
    async json() {
      return { error: 6, message: "nope" };
    },
  }));
  assert.equal(failed.ok, false);
  assert.deepEqual(parseLastFmSimilar({ error: 6, message: "Artist not found" }), []);

  if (previous === undefined) {
    delete process.env.LASTFM_API_KEY;
  } else {
    process.env.LASTFM_API_KEY = previous;
  }
  clearLastFmSimilarCache();
});

test("suggestions still return nearby pills when Last.fm is skipped", async () => {
  const result = await loadSuggestionPills(
    {
      now: NOW,
      follows: { artists: [{ id: "hozier", name: "Hozier" }], venues: [] },
      dismissed: { artists: [], venues: [] },
      activity: { artists: [], venues: [] },
      savedShows: [],
      location: {
        postalCode: "23505",
        latitude: 36.85,
        longitude: -76.29,
        radiusMiles: 100,
      },
    },
    {
      similarArtists: async () => ({ ok: true, artists: [], skipped: true }),
      loadShows: async () => nearbyShows,
    },
  );
  assert.equal(result.lastfm, "skipped");
  assert.equal(result.artists.some((pill) => pill.name === "Big Thief"), true);
  assert.equal(result.artists.some((pill) => pill.source === "similar"), false);
});

test("mocked Last.fm artists only survive when they have a nearby show", async () => {
  const result = await loadSuggestionPills(
    {
      now: NOW,
      follows: { artists: [{ id: "hozier", name: "Hozier" }], venues: [] },
      dismissed: { artists: [], venues: [] },
      activity: { artists: [], venues: [] },
      savedShows: [],
      location: {
        postalCode: "23505",
        latitude: 36.85,
        longitude: -76.29,
        radiusMiles: 100,
      },
    },
    {
      similarArtists: async () => ({
        ok: true,
        skipped: false,
        artists: [
          { name: "Phoebe Bridgers", match: 0.7 },
          { name: "Nobody Nearby", match: 0.99 },
        ],
      }),
      loadShows: async () => nearbyShows,
    },
  );
  assert.equal(result.lastfm, "ok");
  assert.equal(result.artists[0]?.name, "Phoebe Bridgers");
  assert.equal(result.artists[0]?.reason, "Like Hozier · Norfolk Oct 12");
  assert.equal(result.artists.some((pill) => pill.name === "Nobody Nearby"), false);
});

test("suggestion requests reject a broken location and ignore bad activity ids", () => {
  assert.equal(parseSuggestionRequest({ location: { radiusMiles: 0 } }).ok, false);
  const parsed = parseSuggestionRequest({
    location: { postalCode: "23505", radiusMiles: 100 },
    openedArtists: [
      { id: "bad id", signal: "opened" },
      { id: "K8vZ9171J7f", signal: "going", name: "Wilco" },
    ],
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.openedArtists, [
      { id: "K8vZ9171J7f", name: "Wilco", signal: "going" },
    ]);
    assert.equal(parsed.location?.postalCode, "23505");
  }
});
