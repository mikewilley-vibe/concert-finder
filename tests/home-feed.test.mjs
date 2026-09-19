import assert from "node:assert/strict";
import test from "node:test";

import { favoritesProgress } from "../mobile/lib/favorites-progress.ts";
import {
  artistReachMiles,
  buildHomeFeed,
  distanceMiles,
  favoriteIdsFromFollows,
  homeArtistKicker,
  isStrongRadarShow,
  isWithinDays,
  previewYourArtists,
  scanDateLabel,
  scoreShow,
  SHOWS_PER_FAVORITE_ARTIST,
} from "../mobile/lib/home-feed.ts";
import {
  DEFAULT_RADIUS_MILES,
  parseStoredHomeLocation,
  radiusLine,
  showingNearLine,
  upcomingSearchFields,
} from "../mobile/lib/home-location.ts";
import {
  applyInteraction,
  engagementScore,
  parseInteractionSignals,
} from "../mobile/lib/interaction-signals.ts";

const NOW = new Date(2026, 8, 15, 12, 0, 0);
const RICHMOND = { latitude: 37.5411, longitude: -77.434601 };
const NORFOLK = { latitude: 36.9168, longitude: -76.2875 };

function show(id, extras = {}) {
  return {
    id,
    name: extras.name ?? id,
    dateLabel: extras.localDate ?? "September 18",
    localDate: extras.localDate ?? "2026-09-18",
    startsAt: extras.startsAt ?? `${extras.localDate ?? "2026-09-18"}T23:30:00Z`,
    timeLabel: extras.timeLabel ?? "7:30 PM",
    venueId: extras.venueId ?? "venue-1",
    venueName: extras.venueName ?? "The National",
    city: extras.city ?? "Richmond",
    state: extras.state ?? "VA",
    venueLatitude: extras.venueLatitude ?? RICHMOND.latitude,
    venueLongitude: extras.venueLongitude ?? RICHMOND.longitude,
    attractions: extras.attractions ?? [{ id: "artist-a", name: "Artist A" }],
    matchedLabels: extras.matchedLabels ?? [],
    priceLabel: extras.priceLabel,
    statusLabel: extras.statusLabel,
  };
}

const favorites = favoriteIdsFromFollows(
  [{ item_key: "artist-a" }],
  [{ item_key: "venue-fav" }],
);

test("favorite progress uses 10 artists and 5 venues", () => {
  const partial = favoritesProgress(3, 2);
  assert.equal(partial.artistLabel, "Artists: 3 of 10");
  assert.equal(partial.venueLabel, "Venues: 2 of 5");
  assert.equal(partial.artistGoal, 10);
  assert.equal(partial.venueGoal, 5);
  assert.equal(partial.complete, false);
  assert.equal(favoritesProgress(5, 3).complete, false);
  assert.equal(favoritesProgress(10, 5).complete, true);
  assert.equal(favoritesProgress(8, 10).artistLabel, "Artists: 8 of 10");
  assert.equal(favoritesProgress(12, 10).artistLabel, "Artists: 10 of 10");
  assert.equal(favoritesProgress(12, 10).venueLabel, "Venues: 5 of 5");
});

test("7-day and 30-day filters use local calendar dates", () => {
  const today = show("today", { localDate: "2026-09-15" });
  const day7 = show("day7", { localDate: "2026-09-21" });
  const day8 = show("day8", { localDate: "2026-09-22" });
  const day30 = show("day30", { localDate: "2026-10-14" });
  const day31 = show("day31", { localDate: "2026-10-15" });
  assert.equal(isWithinDays(today, 7, NOW), true);
  assert.equal(isWithinDays(day7, 7, NOW), true);
  assert.equal(isWithinDays(day8, 7, NOW), false);
  assert.equal(isWithinDays(day30, 30, NOW), true);
  assert.equal(isWithinDays(day31, 30, NOW), false);
});

test("scan dates use TONIGHT, TOMORROW, and weekday labels", () => {
  assert.equal(scanDateLabel(show("t", { localDate: "2026-09-15" }), NOW), "TONIGHT");
  assert.equal(
    scanDateLabel(show("tm", { localDate: "2026-09-16" }), NOW),
    "TOMORROW",
  );
  assert.equal(
    scanDateLabel(show("fri", { localDate: "2026-09-18" }), NOW),
    "FRI SEP 18",
  );
});

test("Near You keeps this-week favorite shows and still lists them under Your Artists", () => {
  const thisWeekFavorite = show("fav-week", {
    localDate: "2026-09-18",
    attractions: [{ id: "artist-a", name: "Artist A" }],
  });
  const laterFavorite = show("fav-later", {
    localDate: "2026-10-02",
    attractions: [{ id: "artist-a", name: "Artist A" }],
  });
  const genericWeek = show("generic", {
    localDate: "2026-09-17",
    attractions: [{ id: "other", name: "Other" }],
    venueId: "other-venue",
  });

  const feed = buildHomeFeed({
    nearbyShows: [genericWeek, thisWeekFavorite],
    followedShows: [thisWeekFavorite, laterFavorite],
    favorites,
    origin: RICHMOND,
    radiusMiles: 100,
    now: NOW,
  });

  assert.deepEqual(
    feed.nearYou.map((item) => item.show.id),
    ["generic"],
  );
  assert.equal(feed.radar?.show.id, "fav-week");
  assert.deepEqual(
    feed.yourArtists.map((item) => item.show.id),
    ["fav-week", "fav-later"],
  );
  assert.deepEqual(
    feed.yourArtists.map((item) => item.artistLabel),
    ["Artist A", "Artist A"],
  );
});

test("zero favorites still fills Near You This Week", () => {
  const generic = show("generic", {
    attractions: [{ id: "stranger", name: "Stranger" }],
  });
  const feed = buildHomeFeed({
    nearbyShows: [generic],
    followedShows: [],
    favorites: favoriteIdsFromFollows([], []),
    origin: RICHMOND,
    radiusMiles: 100,
    now: NOW,
  });
  assert.equal(feed.radar, null);
  assert.deepEqual(
    feed.nearYou.map((item) => item.show.id),
    ["generic"],
  );
  assert.deepEqual(feed.yourArtists, []);
});

test("generic nearby shows never become On Your Radar", () => {
  const generic = show("generic", {
    attractions: [{ id: "stranger", name: "Stranger" }],
  });
  const ranked = scoreShow(generic, {
    favorites,
    origin: RICHMOND,
    radiusMiles: 100,
    now: NOW,
  });
  assert.equal(isStrongRadarShow(ranked, NOW), false);
});

test("ranking puts favorite artists above venues, engagement, and distance", () => {
  const farFavoriteArtist = show("far-artist", {
    localDate: "2026-09-20",
    attractions: [{ id: "artist-a", name: "Artist A" }],
    venueLatitude: NORFOLK.latitude,
    venueLongitude: NORFOLK.longitude,
  });
  const nearbyFavoriteVenue = show("fav-venue", {
    localDate: "2026-09-16",
    attractions: [{ id: "other", name: "Other" }],
    venueId: "venue-fav",
  });
  const nearbyGeneric = show("generic-close", {
    localDate: "2026-09-16",
    attractions: [{ id: "other", name: "Other" }],
    venueId: "other-venue",
  });

  const context = {
    favorites,
    origin: RICHMOND,
    radiusMiles: 100,
    now: NOW,
    signals: applyInteraction(parseInteractionSignals(null), {
      kind: "ticket",
      eventId: "generic-close",
      at: NOW.getTime(),
    }),
  };

  const artist = scoreShow(farFavoriteArtist, context);
  const venue = scoreShow(nearbyFavoriteVenue, context);
  const generic = scoreShow(nearbyGeneric, context);

  assert.ok(artist.score > venue.score);
  assert.ok(venue.score > generic.score);
  assert.ok(engagementScore(context.signals.events["generic-close"]) > 0);
  assert.ok(artist.favoriteArtist);
  assert.equal(generic.favoriteArtist, false);
});

test("Going engagement is strong but still below an explicit favorite artist", () => {
  const goingSignals = applyInteraction(parseInteractionSignals(null), {
    kind: "attendance",
    eventId: "generic-close",
    toStatus: "going",
    at: NOW.getTime(),
  });
  const goingShow = scoreShow(
    show("generic-close", {
      localDate: "2026-09-16",
      attractions: [{ id: "other", name: "Other" }],
      venueId: "other-venue",
    }),
    {
      favorites,
      origin: RICHMOND,
      radiusMiles: 100,
      now: NOW,
      signals: goingSignals,
    },
  );
  const favorite = scoreShow(
    show("favorite-artist", {
      localDate: "2026-09-20",
      attractions: [{ id: "artist-a", name: "Artist A" }],
      venueLatitude: 34.05,
      venueLongitude: -118.24,
    }),
    {
      favorites,
      origin: RICHMOND,
      radiusMiles: 100,
      now: NOW,
    },
  );
  assert.ok(goingShow.engagement > 0);
  assert.ok(favorite.score > goingShow.score);
});

test("Your Artists keeps far dates and lists each artist chronologically", () => {
  const nearbyLater = show("near-later", {
    localDate: "2026-10-10",
    attractions: [{ id: "artist-a", name: "Artist A" }],
    venueLatitude: RICHMOND.latitude,
    venueLongitude: RICHMOND.longitude,
  });
  const farSooner = show("far-sooner", {
    localDate: "2026-09-25",
    attractions: [{ id: "artist-a", name: "Artist A" }],
    city: "Los Angeles",
    state: "CA",
    venueLatitude: 34.0522,
    venueLongitude: -118.2437,
  });

  const feed = buildHomeFeed({
    nearbyShows: [],
    followedShows: [farSooner, nearbyLater],
    favorites,
    origin: RICHMOND,
    radiusMiles: 100,
    now: NOW,
  });

  assert.deepEqual(
    feed.yourArtists.map((item) => item.show.id),
    ["far-sooner", "near-later"],
  );
  assert.equal(feed.yourArtists[0].inRadius, false);
  assert.ok((feed.yourArtists[0].distanceMiles ?? 0) > 100);
  assert.equal(feed.yourArtists[1].inRadius, true);
  assert.equal(
    homeArtistKicker(feed.yourArtists[0]),
    "Artist A · FRI SEP 25",
  );
});

test("Your Artists takes the next 2 upcoming shows per favorite, including far-future dates", () => {
  assert.equal(SHOWS_PER_FAVORITE_ARTIST, 2);
  const both = favoriteIdsFromFollows(
    [{ item_key: "artist-a" }, { item_key: "artist-b" }],
    [],
  );
  const artistA = [
    show("a-1", {
      localDate: "2026-09-20",
      attractions: [{ id: "artist-a", name: "Artist A" }],
    }),
    show("a-2", {
      localDate: "2026-10-01",
      attractions: [{ id: "artist-a", name: "Artist A" }],
      venueLatitude: 34.0522,
      venueLongitude: -118.2437,
      city: "Los Angeles",
      state: "CA",
    }),
    show("a-3", {
      localDate: "2026-10-08",
      attractions: [{ id: "artist-a", name: "Artist A" }],
    }),
  ];
  const artistB = [
    show("b-1", {
      localDate: "2026-11-01",
      attractions: [{ id: "artist-b", name: "Artist B" }],
      venueLatitude: 41.8781,
      venueLongitude: -87.6298,
      city: "Chicago",
      state: "IL",
    }),
    show("b-2", {
      localDate: "2026-11-20",
      attractions: [{ id: "artist-b", name: "Artist B" }],
    }),
    show("b-3", {
      localDate: "2026-12-02",
      attractions: [{ id: "artist-b", name: "Artist B" }],
    }),
  ];

  const feed = buildHomeFeed({
    nearbyShows: [],
    followedShows: [...artistA, ...artistB],
    favorites: both,
    origin: RICHMOND,
    radiusMiles: 100,
    now: NOW,
  });

  assert.deepEqual(
    feed.yourArtists.map((item) => ({
      id: item.show.id,
      artist: item.artistLabel,
    })),
    [
      { id: "a-1", artist: "Artist A" },
      { id: "a-2", artist: "Artist A" },
      { id: "b-1", artist: "Artist B" },
      { id: "b-2", artist: "Artist B" },
    ],
  );
  assert.equal(feed.yourArtists[1].inRadius, false);
  assert.equal(isWithinDays(artistB[0], 30, NOW), false);
  const preview = previewYourArtists(feed.yourArtists, 2);
  assert.deepEqual(
    preview.map((item) => item.show.id),
    ["a-1", "a-2"],
  );
});

test("a shared bill counts toward each favorite artist's next 2", () => {
  const shared = show("fest", {
    localDate: "2026-09-20",
    attractions: [
      { id: "artist-a", name: "Artist A" },
      { id: "artist-b", name: "Artist B" },
    ],
  });
  const feed = buildHomeFeed({
    nearbyShows: [],
    followedShows: [shared],
    favorites: favoriteIdsFromFollows(
      [{ item_key: "artist-a" }, { item_key: "artist-b" }],
      [],
    ),
    origin: RICHMOND,
    radiusMiles: 100,
    now: NOW,
  });
  assert.deepEqual(
    feed.yourArtists.map((item) => `${item.artistLabel}:${item.show.id}`),
    ["Artist A:fest", "Artist B:fest"],
  );
});

test("Your Artists skips past dates", () => {
  const past = show("past", { localDate: "2026-09-01" });
  const next = show("next", { localDate: "2026-09-22" });
  const feed = buildHomeFeed({
    nearbyShows: [],
    followedShows: [past, next],
    favorites,
    origin: RICHMOND,
    radiusMiles: 100,
    now: NOW,
  });
  assert.deepEqual(
    feed.yourArtists.map((item) => item.show.id),
    ["next"],
  );
});

test("default search radius is 100 miles and artist reach is slightly wider", () => {
  assert.equal(DEFAULT_RADIUS_MILES, 100);
  assert.equal(artistReachMiles(100), 150);
  assert.equal(artistReachMiles(250), 300);
  const miles = distanceMiles(NORFOLK, RICHMOND);
  assert.ok(miles > 70 && miles < 110);
});

test("location copy names the active area and radius", () => {
  assert.equal(
    showingNearLine({
      postalCode: "",
      radiusMiles: 100,
      latitude: RICHMOND.latitude,
      longitude: RICHMOND.longitude,
      source: "current",
      placeLabel: "Richmond, VA",
      homePostalCode: "",
      homePlaceLabel: "",
      homeLatitude: null,
      homeLongitude: null,
    }),
    "Shows near Richmond, VA",
  );
  assert.equal(
    radiusLine({
      postalCode: "",
      radiusMiles: 100,
      latitude: RICHMOND.latitude,
      longitude: RICHMOND.longitude,
      source: "current",
      placeLabel: "Richmond, VA",
      homePostalCode: "",
      homePlaceLabel: "",
      homeLatitude: null,
      homeLongitude: null,
    }),
    "Within 100 miles of your current location",
  );
  assert.equal(
    showingNearLine({
      postalCode: "23220",
      radiusMiles: 100,
      latitude: null,
      longitude: null,
      source: "home",
      placeLabel: "",
      homePostalCode: "23220",
      homePlaceLabel: "Richmond, VA",
      homeLatitude: null,
      homeLongitude: null,
    }),
    "Shows near Richmond, VA",
  );
  assert.deepEqual(
    upcomingSearchFields({
      postalCode: "23220",
      radiusMiles: 100,
      latitude: RICHMOND.latitude,
      longitude: RICHMOND.longitude,
      source: "home",
      placeLabel: "Norfolk, VA",
      homePostalCode: "23220",
      homePlaceLabel: "",
      homeLatitude: null,
      homeLongitude: null,
    }),
    { postalCode: "23220", radiusMiles: 100 },
  );
  assert.equal(parseStoredHomeLocation(null).radiusMiles, 100);
});
