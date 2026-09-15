import assert from "node:assert/strict";
import test from "node:test";

import { favoriteArtistSearchJobs } from "../mobile/lib/home-event-searches.ts";

test("favorite artist home fetch does not apply a nearby radius", () => {
  const jobs = favoriteArtistSearchJobs([
    { item_key: "artist-a", item_label: "Artist A" },
    { item_key: "artist-b", item_label: "Artist B" },
  ]);

  assert.equal(jobs.length, 1);
  const job = jobs[0];
  assert.deepEqual(
    job.attractions.map((item) => item.id),
    ["artist-a", "artist-b"],
  );
  assert.deepEqual(job.venues, []);
  assert.equal("latitude" in job, false);
  assert.equal("longitude" in job, false);
  assert.equal("postalCode" in job, false);
  assert.equal("radiusMiles" in job, false);
  assert.equal("endDateTime" in job, false);
});
