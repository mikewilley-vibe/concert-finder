import assert from "node:assert/strict";
import test from "node:test";

import { venueFollowDetails } from "../mobile/lib/follow-management.ts";

test("follow management shows venue location and distance when available", () => {
  const details = venueFollowDetails(
    [{ item_key: "venue-930", item_label: "9:30 Club" }],
    [
      {
        id: "show-1",
        name: "A show",
        dateLabel: "Oct 10",
        venueId: "venue-930",
        venueName: "9:30 Club",
        city: "Washington",
        state: "DC",
        venueLatitude: 38.9179,
        venueLongitude: -77.0237,
        attractions: [],
        matchedLabels: [],
      },
    ],
    { latitude: 36.8508, longitude: -76.2859 },
  );

  assert.equal(details.get("venue-930")?.place, "Washington, DC");
  assert.match(details.get("venue-930")?.distanceLabel ?? "", /^\d+ mi$/);
});

test("venue aliases can still provide a place without inventing distance", () => {
  const details = venueFollowDetails(
    [{ item_key: "legacy-id", item_label: "The Annex" }],
    [
      {
        id: "show-2",
        name: "Local show",
        dateLabel: "Nov 1",
        venueName: "Annex",
        city: "Norfolk",
        state: "VA",
        attractions: [],
        matchedLabels: [],
      },
    ],
    null,
  );

  assert.deepEqual(details.get("legacy-id"), {
    place: "Norfolk, VA",
    distanceLabel: null,
  });
});
