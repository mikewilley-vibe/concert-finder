import assert from "node:assert/strict";
import test from "node:test";

import {
  parseVenueCity,
  supplementVenuesForCity,
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

test("Brown's Island survives a Richmond search when Ticketmaster's city filter misses it", () => {
  const found = supplementVenuesForCity(
    [],
    [
      { id: "KovZpZAaFntA", name: "Brown's Island", city: "Richmond" },
      { id: "KovZpZA1dI7A", name: "Brown University", city: "Providence" },
    ],
    "Brown's Island",
    "Richmond",
  );
  assert.deepEqual(
    found.map((venue) => venue.id),
    ["KovZpZAaFntA"],
  );
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
