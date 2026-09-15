import assert from "node:assert/strict";
import test from "node:test";

import { favoritesProgress } from "../mobile/lib/favorites-progress.ts";
import {
  artistReachMiles,
  buildHomeFeed,
  distanceMiles,
  favoriteIdsFromFollows,
  isStrongRadarShow,
  isWithinDays,
  scanDateLabel,
  scoreShow,
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

test("favorite progress uses 5 artists and 3 venues", () => {
  const partial = favoritesProgress(3, 2);
  assert.equal(partial.artistLabel, "Artists: 3 of 5");
  assert.equal(partial.venueLabel, "Venues: 2 of 3");
  assert.equal(partial.complete, false);
  assert.equal(favoritesProgress(5, 3).complete, true);
  assert.equal(favoritesProgress(8, 10).artistLabel, "Artists: 5 of 5");
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

test("Near You keeps this-week favorite shows and dedupes them from Your Artists", () => {
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
    ["fav-later"],
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

test("nearby favorite artists beat farther favorite dates in Your Artists", () => {
  const nearbyLater = show("near-later", {
    localDate: "2026-10-10",
    attractions: [{ id: "artist-a", name: "Artist A" }],
    venueLatitude: RICHMOND.latitude,
    venueLongitude: RICHMOND.longitude,
  });
  const farSooner = show("far-sooner", {
    localDate: "2026-09-25",
    attractions: [{ id: "artist-a", name: "Artist A" }],
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
    ["near-later", "far-sooner"],
  );
  assert.equal(feed.yourArtists[0].inRadius, true);
  assert.equal(feed.yourArtists[1].inRadius, false);
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
    "Showing shows near Richmond, VA",
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
    "Showing shows near Richmond, VA",
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
