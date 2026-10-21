import assert from "node:assert/strict";
import test from "node:test";

import {
  parseVenueCity,
  venuesMatchingCity,
} from "../lib/ticketmaster.ts";

test("venue city is optional and rejects short or odd values", () => {
  assert.deepEqual(parseVenueCity(null), { ok: true, city: "" });
  assert.deepEqual(parseVenueCity("  "), { ok: true, city: "" });
  assert.deepEqual(parseVenueCity(" Norfolk "), { ok: true, city: "Norfolk" });
  assert.equal(parseVenueCity("N").ok, false);
  assert.equal(parseVenueCity("Norfolk!").ok, false);
  assert.equal(parseVenueCity("A".repeat(41)).ok, false);
  assert.deepEqual(parseVenueCity("St. Louis"), { ok: true, city: "St. Louis" });
});

test("venue city filter keeps matching cities only", () => {
  const venues = [
    { id: "1", city: "Norfolk", name: "The NorVa" },
    { id: "2", city: "Washington", name: "The Anthem" },
    { id: "3", city: null, name: "Mystery Room" },
  ];
  assert.deepEqual(
    venuesMatchingCity(venues, "norfolk").map((venue) => venue.id),
    ["1"],
  );
  assert.equal(venuesMatchingCity(venues, "").length, 3);
});
