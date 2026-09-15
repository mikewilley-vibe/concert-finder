import assert from "node:assert/strict";
import test from "node:test";

import {
  clearHomeEventSetsCache,
  loadHomeEventSets,
} from "../mobile/lib/home-events.ts";
import { artistReachMiles } from "../mobile/lib/home-feed.ts";

const RICHMOND = {
  latitude: 37.5411,
  longitude: -77.434601,
};

const location = {
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
};

test("favorite artist home fetch does not apply a nearby radius", async () => {
  clearHomeEventSetsCache();
  const calls = [];
  const search = async (input) => {
    calls.push(input);
    return { shows: [] };
  };

  await loadHomeEventSets({
    location,
    artists: [{ item_key: "artist-a", item_label: "Artist A" }],
    venues: [{ item_key: "venue-v", item_label: "The National" }],
    search,
  });

  const artistCall = calls.find((call) =>
    call.attractions?.some((item) => item.id === "artist-a"),
  );
  const venueCall = calls.find((call) =>
    call.venues?.some((item) => item.id === "venue-v"),
  );
  const nearbyCall = calls.find(
    (call) =>
      (call.attractions?.length ?? 0) === 0 &&
      (call.venues?.length ?? 0) === 0,
  );

  assert.ok(artistCall, "expected a dedicated favorite-artist search");
  assert.equal(artistCall.latitude, undefined);
  assert.equal(artistCall.longitude, undefined);
  assert.equal(artistCall.postalCode, undefined);
  assert.equal(artistCall.radiusMiles, undefined);
  assert.equal(artistCall.endDateTime, undefined);
  assert.deepEqual(artistCall.venues, []);

  assert.ok(venueCall, "expected favorite venues to keep a radius search");
  assert.equal(venueCall.latitude, RICHMOND.latitude);
  assert.equal(venueCall.radiusMiles, artistReachMiles(100));
  assert.ok(venueCall.endDateTime);

  assert.ok(nearbyCall, "expected Near You to keep a radius search");
  assert.equal(nearbyCall.radiusMiles, 100);
  assert.equal(nearbyCall.latitude, RICHMOND.latitude);
});
