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
