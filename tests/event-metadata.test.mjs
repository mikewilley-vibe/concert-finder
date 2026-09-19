import assert from "node:assert/strict";
import test from "node:test";

import {
  eventSourceLine,
  eventStatusPresentation,
} from "../mobile/lib/event-metadata.ts";

test("disrupted event statuses are normalized and prominent", () => {
  assert.deepEqual(
    eventStatusPresentation({ status: "cancelled" }),
    { label: "Canceled", disrupted: true },
  );
  assert.deepEqual(
    eventStatusPresentation({ status: "postponed" }),
    { label: "Postponed", disrupted: true },
  );
  assert.deepEqual(
    eventStatusPresentation({ status: "rescheduled" }),
    { label: "Rescheduled", disrupted: true },
  );
});

test("ordinary upstream labels remain non-disruptive", () => {
  assert.deepEqual(
    eventStatusPresentation({ status: "onsale", statusLabel: "On sale" }),
    { label: "On sale", disrupted: false },
  );
  assert.equal(eventStatusPresentation({}), null);
});

test("source copy defaults to Ticketmaster and adds trustworthy freshness", () => {
  assert.equal(eventSourceLine({}), "Source: Ticketmaster");
  assert.equal(
    eventSourceLine(
      {
        sourceName: "Local Buzz 757",
        sourceUpdatedAt: "2026-09-18T15:00:00Z",
      },
      new Date("2026-09-19T12:00:00Z"),
    ),
    "Source: Local Buzz 757 · Updated Sep 18",
  );
});
