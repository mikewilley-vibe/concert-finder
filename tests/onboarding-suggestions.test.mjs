import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOnboardingSuggestions,
} from "../mobile/lib/onboarding-suggestion-ranking.ts";

function show({
  id,
  startsAt,
  venueId,
  venueName,
  city,
  state,
  latitude,
  longitude,
  artists,
}) {
  return {
    id,
    name: artists[0]?.name ?? "Show",
    dateLabel: "Oct 1",
    startsAt,
    venueId,
    venueName,
    city,
    state,
    venueLatitude: latitude,
    venueLongitude: longitude,
    attractions: artists,
    matchedLabels: [],
  };
}

test("suggestions prioritize close venues and artists with more nearby shows", () => {
  const shows = [
    show({
      id: "far-show",
      startsAt: "2026-10-03T00:00:00Z",
      venueId: "far",
      venueName: "Far Hall",
      city: "Washington",
      state: "DC",
      latitude: 38.9072,
      longitude: -77.0369,
      artists: [{ id: "artist-b", name: "Band B" }],
    }),
    show({
      id: "near-show-1",
      startsAt: "2026-10-01T00:00:00Z",
      venueId: "near",
      venueName: "Near Room",
      city: "Richmond",
      state: "VA",
      latitude: 37.541,
      longitude: -77.436,
      artists: [{ id: "artist-a", name: "Band A" }],
    }),
    show({
      id: "near-show-2",
      startsAt: "2026-10-02T00:00:00Z",
      venueId: "near",
      venueName: "Near Room",
      city: "Richmond",
      state: "VA",
      latitude: 37.541,
      longitude: -77.436,
      artists: [
        { id: "artist-a", name: "Band A" },
        { id: "artist-c", name: "Band C" },
      ],
    }),
  ];

  const result = buildOnboardingSuggestions(shows, {
    latitude: 37.5407,
    longitude: -77.436,
  });

  assert.deepEqual(
    result.venues.map((venue) => venue.id),
    ["near", "far"],
  );
  assert.match(result.venues[0].meta, /Richmond, VA/);
  assert.equal(result.venues[0].showCount, 2);
  assert.deepEqual(
    result.artists.map((artist) => artist.id),
    ["artist-a", "artist-c", "artist-b"],
  );
  assert.equal(result.artists[0].meta, "2 upcoming shows");
});

test("suggestions skip items that cannot be followed and respect limits", () => {
  const result = buildOnboardingSuggestions(
    [
      show({
        id: "show-1",
        startsAt: "2026-10-01T00:00:00Z",
        venueId: "",
        venueName: "Unlinked Place",
        city: "Richmond",
        state: "VA",
        artists: [
          { id: "", name: "Unknown" },
          { id: "artist-a", name: "Band A" },
        ],
      }),
    ],
    null,
    { artistLimit: 0, venueLimit: 4 },
  );

  assert.deepEqual(result, { venues: [], artists: [] });
});
