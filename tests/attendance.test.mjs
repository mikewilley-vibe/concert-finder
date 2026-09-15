import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAttendanceStatus,
  hasCalendarEvent,
  mergeAttendanceStates,
  nextExclusiveStatus,
  parseAttendanceState,
  rememberCalendarLink,
  shouldWriteCalendarEvent,
  showsWithStatus,
  statusFor,
} from "../mobile/lib/attendance.ts";
import {
  buildCalendarEvent,
  calendarEventDescription,
  calendarEventLocation,
  calendarEventTitle,
  calendarWindow,
  writeShowCalendarEvent,
} from "../mobile/lib/calendar-window.ts";
import {
  applyInteraction,
  engagementScore,
  parseInteractionSignals,
} from "../mobile/lib/interaction-signals.ts";

const RICHMOND_SHOW = {
  id: "tm-richmond",
  name: "Phish",
  dateLabel: "October 3",
  timeLabel: "7:30 PM",
  localDate: "2026-10-03",
  localTime: "19:30:00",
  startsAt: "2026-10-03T23:30:00Z",
  timezone: "America/New_York",
  doorTime: "18:00:00",
  venueName: "Virginia Credit Union Live!",
  venueAddress: "600 E Leigh St",
  city: "Richmond",
  state: "VA",
  url: "https://www.ticketmaster.com/event/tm-richmond",
  attractions: [
    { id: "artist-phish", name: "Phish" },
    { id: "artist-trey", name: "Trey Anastasio" },
  ],
  matchedLabels: [],
};

function emptyState() {
  return parseAttendanceState(null);
}

test("attendance statuses are mutually exclusive and can clear to neither", () => {
  let state = emptyState();
  state = applyAttendanceStatus(state, RICHMOND_SHOW, "interested", 1);
  assert.equal(statusFor(state, RICHMOND_SHOW.id), "interested");
  assert.deepEqual(
    showsWithStatus(state, "interested").map((show) => show.id),
    [RICHMOND_SHOW.id],
  );

  state = applyAttendanceStatus(state, RICHMOND_SHOW, "going", 2);
  assert.equal(statusFor(state, RICHMOND_SHOW.id), "going");
  assert.equal(showsWithStatus(state, "interested").length, 0);
  assert.equal(showsWithStatus(state, "going").length, 1);

  state = applyAttendanceStatus(state, RICHMOND_SHOW, "interested", 3);
  assert.equal(statusFor(state, RICHMOND_SHOW.id), "interested");

  state = applyAttendanceStatus(state, RICHMOND_SHOW, null, 4);
  assert.equal(statusFor(state, RICHMOND_SHOW.id), null);
  assert.equal(showsWithStatus(state, "interested").length, 0);
  assert.equal(showsWithStatus(state, "going").length, 0);
});

test("tapping the active status clears; tapping the other switches", () => {
  assert.equal(nextExclusiveStatus(null, "interested"), "interested");
  assert.equal(nextExclusiveStatus("interested", "interested"), null);
  assert.equal(nextExclusiveStatus("interested", "going"), "going");
  assert.equal(nextExclusiveStatus("going", "going"), null);
  assert.equal(nextExclusiveStatus("going", "interested"), "interested");
});

test("attendance persistence round-trips status, snapshot, and calendar id", () => {
  let state = applyAttendanceStatus(emptyState(), RICHMOND_SHOW, "going", 10);
  state = rememberCalendarLink(state, RICHMOND_SHOW.id, {
    provider: "native",
    externalCalendarEventId: "cal-1",
    addedAt: 11,
  });
  const parsed = parseAttendanceState(JSON.stringify(state));
  assert.equal(statusFor(parsed, RICHMOND_SHOW.id), "going");
  assert.equal(parsed.records[RICHMOND_SHOW.id].show.localTime, "19:30:00");
  assert.equal(
    parsed.records[RICHMOND_SHOW.id].calendar?.externalCalendarEventId,
    "cal-1",
  );
});

test("clearing Going keeps the native calendar id for a later retap", () => {
  let state = applyAttendanceStatus(emptyState(), RICHMOND_SHOW, "going", 1);
  state = rememberCalendarLink(state, RICHMOND_SHOW.id, {
    provider: "native",
    externalCalendarEventId: "cal-keep",
    addedAt: 2,
  });
  state = applyAttendanceStatus(state, RICHMOND_SHOW, null, 3);
  assert.equal(statusFor(state, RICHMOND_SHOW.id), null);
  assert.equal(
    state.records[RICHMOND_SHOW.id].calendar?.externalCalendarEventId,
    "cal-keep",
  );
  assert.equal(shouldWriteCalendarEvent(state.records[RICHMOND_SHOW.id].calendar), false);
});

test("calendar payload keeps Richmond 7:30pm local and omits empty fields", () => {
  const window = calendarWindow(RICHMOND_SHOW);
  assert.equal(window.ok, true);
  if (window.ok) {
    assert.equal(window.allDay, false);
    assert.equal(window.start.getHours(), 19);
    assert.equal(window.start.getMinutes(), 30);
    assert.equal(window.endSource, "estimated_3h");
    assert.equal(window.end.getTime() - window.start.getTime(), 3 * 60 * 60 * 1000);
  }

  const built = buildCalendarEvent(RICHMOND_SHOW, "https://concert-finder-eta.vercel.app");
  assert.equal(built.ok, true);
  if (!built.ok) {
    return;
  }
  assert.equal(built.payload.title, "Phish & Trey Anastasio — Live");
  assert.equal(
    built.payload.location,
    "Virginia Credit Union Live!, 600 E Leigh St, Richmond, VA",
  );
  assert.equal(built.payload.start.getHours(), 19);
  assert.match(built.payload.notes, /Artist: Phish/);
  assert.match(built.payload.notes, /Doors: 6:00 PM/);
  assert.match(built.payload.notes, /Show time: 7:30 PM/);
  assert.match(built.payload.notes, /Supports: Trey Anastasio/);
  assert.match(built.payload.notes, /Tickets: https:\/\/www\.ticketmaster\.com/);
  assert.match(built.payload.notes, /ShowSignal: https:\/\/concert-finder-eta\.vercel\.app\/open\/concert\//);
  assert.equal(built.payload.notes.includes("undefined"), false);
});

test("UTC startsAt does not override a known local show time", () => {
  const window = calendarWindow({
    localDate: "2026-10-03",
    localTime: "19:30:00",
    startsAt: "2026-10-03T23:30:00Z",
  });
  assert.equal(window.ok, true);
  if (window.ok) {
    assert.equal(window.start.getHours(), 19);
    assert.equal(window.start.getMinutes(), 30);
  }
});

test("date-only shows are all-day and never invent a start time", () => {
  const window = calendarWindow({ localDate: "2026-10-03" });
  assert.equal(window.ok, true);
  if (window.ok) {
    assert.equal(window.allDay, true);
    assert.equal(window.endSource, "all_day");
  }
  assert.equal(calendarWindow({}).ok, false);
  assert.equal(
    calendarEventTitle({
      ...RICHMOND_SHOW,
      attractions: [],
    }),
    "Phish — Live",
  );
});

test("calendar description omits missing doors, supports, and ticket url", () => {
  const notes = calendarEventDescription(
    {
      ...RICHMOND_SHOW,
      doorTime: undefined,
      timeLabel: undefined,
      localTime: undefined,
      url: undefined,
      venueAddress: undefined,
      attractions: [{ id: "artist-phish", name: "Phish" }],
    },
    "https://concert-finder-eta.vercel.app",
  );
  assert.equal(notes.includes("Doors:"), false);
  assert.equal(notes.includes("Show time:"), false);
  assert.equal(notes.includes("Supports:"), false);
  assert.equal(notes.includes("Tickets:"), false);
  assert.equal(notes.includes("Address:"), false);
  assert.match(notes, /ShowSignal:/);
  assert.equal(calendarEventLocation({ ...RICHMOND_SHOW, venueAddress: undefined }), "Virginia Credit Union Live!, Richmond, VA");
});

test("addShowToCalendar does not create a second event when one is stored", async () => {
  let creates = 0;
  const writer = {
    requestPermission: async () => "granted",
    createEvent: async () => {
      creates += 1;
      return { id: `event-${creates}` };
    },
  };

  const first = await writeShowCalendarEvent(
    RICHMOND_SHOW,
    null,
    writer,
    "https://concert-finder-eta.vercel.app",
    100,
  );
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.skipped, false);
  assert.equal(first.link.externalCalendarEventId, "event-1");
  assert.equal(creates, 1);

  const second = await writeShowCalendarEvent(
    RICHMOND_SHOW,
    first.link,
    writer,
    "https://concert-finder-eta.vercel.app",
    200,
  );
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.skipped, true);
  assert.equal(second.link.externalCalendarEventId, "event-1");
  assert.equal(creates, 1);
  assert.equal(hasCalendarEvent(second.link), true);
});

test("going is a stronger ranking signal than interested, and both beat a save", () => {
  const interested = applyInteraction(parseInteractionSignals(null), {
    kind: "attendance",
    eventId: "show-a",
    toStatus: "interested",
    at: 1,
  });
  const going = applyInteraction(interested, {
    kind: "attendance",
    eventId: "show-a",
    fromStatus: "interested",
    toStatus: "going",
    at: 2,
  });
  const saved = applyInteraction(parseInteractionSignals(null), {
    kind: "save",
    eventId: "show-b",
    at: 1,
  });

  assert.equal(going.events["show-a"].interested, 0);
  assert.equal(going.events["show-a"].going, 1);
  assert.ok(
    engagementScore(going.events["show-a"]) >
      engagementScore(interested.events["show-a"]),
  );
  assert.ok(
    engagementScore(interested.events["show-a"]) >
      engagementScore(saved.events["show-b"]),
  );
});

test("merge prefers newer attendance and keeps the device calendar id", () => {
  const local = rememberCalendarLink(
    applyAttendanceStatus(emptyState(), RICHMOND_SHOW, "interested", 5),
    RICHMOND_SHOW.id,
    { provider: "native", externalCalendarEventId: "phone-cal", addedAt: 5 },
  );
  const remote = applyAttendanceStatus(emptyState(), RICHMOND_SHOW, "going", 9);
  const merged = mergeAttendanceStates(local, remote);
  assert.equal(statusFor(merged, RICHMOND_SHOW.id), "going");
  assert.equal(
    merged.records[RICHMOND_SHOW.id].calendar?.externalCalendarEventId,
    "phone-cal",
  );
});
