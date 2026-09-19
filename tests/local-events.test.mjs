import assert from "node:assert/strict";
import test from "node:test";

import {
  filterLocalEventsForSearch,
  mapLocalEvent,
  mergeEventSources,
} from "../lib/local-events.ts";

function localRow(overrides = {}) {
  return {
    id: "local-1",
    artist: "The Band",
    venue: "The Annex",
    city: "Norfolk",
    event_date: "2026-10-10T23:00:00Z",
    description: null,
    created_at: "2026-09-18T12:00:00Z",
    is_published: true,
    source_name: "Local Buzz 757",
    latitude: 36.85,
    longitude: -76.29,
    timezone: "America/New_York",
    ...overrides,
  };
}

test("maps an approved local record into the shared event contract", () => {
  const event = mapLocalEvent(localRow());
  assert.ok(event);
  assert.equal(event.source.label, "Local Buzz 757");
  assert.equal(event.source.updatedAt, "2026-09-18T12:00:00Z");
  assert.equal(event.venue.name, "The Annex");
  assert.equal(event.localDate, "2026-10-10");
});

test("does not expose drafts or rows without a usable date", () => {
  assert.equal(mapLocalEvent(localRow({ is_published: false })), null);
  assert.equal(mapLocalEvent(localRow({ event_date: null })), null);
});

test("Ticketmaster wins when a local record describes the same show", () => {
  const local = mapLocalEvent(localRow());
  assert.ok(local);
  const ticketmaster = {
    ...local,
    id: "tm-1",
    name: "Band Live",
    attractions: [{ id: "tm-a", name: "Band", imageUrl: null }],
    source: { id: "ticketmaster", label: "Ticketmaster", url: null, updatedAt: null },
  };
  const merged = mergeEventSources([ticketmaster], [local]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "tm-1");
});

test("followed artist searches can match local events without a home location", async () => {
  const local = mapLocalEvent(localRow());
  assert.ok(local);
  const matched = await filterLocalEventsForSearch([local], {
    attractions: [{ id: "tm-band", label: "Band" }],
    venues: [],
  });
  assert.deepEqual(matched.map((event) => event.id), [local.id]);
});
