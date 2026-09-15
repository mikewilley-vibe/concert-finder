export type CalendarShowTimes = {
  localDate?: string;
  localTime?: string;
  startsAt?: string;
};

export type CalendarWindow =
  | {
      ok: true;
      start: Date;
      end: Date;
      allDay: boolean;
      /** V1 always estimates a 3-hour timed show when Ticketmaster has no end. */
      endSource: "estimated_3h" | "all_day";
    }
  | { ok: false };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;
export const DEFAULT_SHOW_DURATION_MS = 3 * 60 * 60 * 1000;

function padTime(localTime: string) {
  return localTime.length === 5 ? `${localTime}:00` : localTime;
}

/**
 * Prefer venue-local wall-clock fields so 7:30pm in Richmond stays 7:30pm.
 * `startsAt` (UTC instant) is only used when no reliable local time exists.
 * Date-only shows become all-day — never invent a start time.
 */
export function calendarWindow(show: CalendarShowTimes): CalendarWindow {
  const localDate = show.localDate?.trim() ?? "";
  const localTime = show.localTime?.trim() ?? "";

  if (DATE_PATTERN.test(localDate) && TIME_PATTERN.test(localTime)) {
    const start = new Date(`${localDate}T${padTime(localTime)}`);
    if (Number.isNaN(start.getTime())) {
      return { ok: false };
    }
    return {
      ok: true,
      start,
      end: new Date(start.getTime() + DEFAULT_SHOW_DURATION_MS),
      allDay: false,
      endSource: "estimated_3h",
    };
  }

  const startsAt = show.startsAt?.trim() ?? "";
  if (startsAt) {
    const start = new Date(startsAt);
    if (!Number.isNaN(start.getTime())) {
      return {
        ok: true,
        start,
        end: new Date(start.getTime() + DEFAULT_SHOW_DURATION_MS),
        allDay: false,
        endSource: "estimated_3h",
      };
    }
  }

  if (!DATE_PATTERN.test(localDate)) {
    return { ok: false };
  }

  const start = new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) {
    return { ok: false };
  }
  return { ok: true, start, end: start, allDay: true, endSource: "all_day" };
}

type CalendarShow = {
  id: string;
  name: string;
  timeLabel?: string;
  localDate?: string;
  localTime?: string;
  startsAt?: string;
  doorTime?: string;
  venueName: string;
  venueAddress?: string;
  city: string;
  state: string;
  url?: string;
  attractions: Array<{ id: string; name: string }>;
};

export type CalendarEventPayload = {
  title: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  notes: string;
  url?: string;
  endSource: Extract<CalendarWindow, { ok: true }>["endSource"];
};

export type BuildCalendarEventResult =
  | { ok: true; payload: CalendarEventPayload }
  | { ok: false; code: "no_date"; message: string };

export type CalendarEventLink = {
  provider: "native" | "google";
  externalCalendarEventId: string;
  addedAt: number;
};

export type CalendarWriteResult =
  | { ok: true; skipped: boolean; link: CalendarEventLink }
  | { ok: false; code: "no_date" | "denied" | "unavailable"; message: string };

export type CalendarEventWriter = {
  requestPermission: () => Promise<"granted" | "denied" | "unavailable">;
  createEvent: (payload: CalendarEventPayload) => Promise<{ id: string }>;
  deleteEvent?: (eventId: string) => Promise<void>;
};

function clockLabel(value: string | undefined) {
  const raw = value?.trim() ?? "";
  if (!TIME_PATTERN.test(raw)) {
    return "";
  }
  const [hours, minutes] = raw.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(trimmed);
  }
  return next;
}

export function artistNamesForTitle(show: CalendarShow) {
  const fromAttractions = uniqueNames(show.attractions.map((artist) => artist.name));
  if (fromAttractions.length > 0) {
    return fromAttractions;
  }
  const fallback = show.name.trim();
  return fallback ? [fallback] : [];
}

export function joinArtistNames(names: string[]) {
  if (names.length === 0) {
    return "";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} & ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export function calendarEventTitle(show: CalendarShow) {
  const names = artistNamesForTitle(show);
  if (names.length === 0) {
    return "Live";
  }
  return `${joinArtistNames(names)} — Live`;
}

export function calendarEventLocation(show: CalendarShow) {
  const place = [show.city, show.state].filter(Boolean).join(", ");
  return [show.venueName.trim(), show.venueAddress?.trim() ?? "", place]
    .filter(Boolean)
    .join(", ");
}

function showsignalConcertUrl(websiteOrigin: string, show: CalendarShow) {
  const path = `/open/concert/${encodeURIComponent(show.id)}?name=${encodeURIComponent(show.name)}`;
  return new URL(path, `${websiteOrigin.replace(/\/$/, "")}/`).toString();
}

export function calendarEventDescription(show: CalendarShow, websiteOrigin: string) {
  const artists = artistNamesForTitle(show);
  const headliner = artists[0] ?? "";
  const supports = artists.slice(1);
  const doors = clockLabel(show.doorTime);
  const showTime = show.timeLabel?.trim() || clockLabel(show.localTime) || "";
  const lines = [
    headliner ? `Artist: ${headliner}` : "",
    show.venueName.trim() ? `Venue: ${show.venueName.trim()}` : "",
    show.venueAddress?.trim() ? `Address: ${show.venueAddress.trim()}` : "",
    [show.city, show.state].filter(Boolean).join(", ")
      ? `City: ${[show.city, show.state].filter(Boolean).join(", ")}`
      : "",
    doors ? `Doors: ${doors}` : "",
    showTime ? `Show time: ${showTime}` : "",
    supports.length > 0 ? `Supports: ${joinArtistNames(supports)}` : "",
    show.url?.trim() ? `Tickets: ${show.url.trim()}` : "",
    `ShowSignal: ${showsignalConcertUrl(websiteOrigin, show)}`,
  ].filter((line) => line.length > 0);
  return lines.join("\n");
}

export function buildCalendarEvent(
  show: CalendarShow,
  websiteOrigin: string,
): BuildCalendarEventResult {
  const window = calendarWindow(show);
  if (!window.ok) {
    return {
      ok: false,
      code: "no_date",
      message: "This concert does not have a date to add yet.",
    };
  }

  const location = calendarEventLocation(show);
  const notes = calendarEventDescription(show, websiteOrigin);
  const url = show.url?.trim();
  const payload: CalendarEventPayload = {
    title: calendarEventTitle(show),
    start: window.start,
    end: window.end,
    allDay: window.allDay,
    notes,
    endSource: window.endSource,
  };
  if (location) payload.location = location;
  if (url) payload.url = url;
  return { ok: true, payload };
}

export async function writeShowCalendarEvent(
  show: CalendarShow,
  existingLink: CalendarEventLink | null | undefined,
  writer: CalendarEventWriter,
  websiteOrigin: string,
  addedAt = Date.now(),
): Promise<CalendarWriteResult> {
  if (existingLink?.externalCalendarEventId) {
    return { ok: true, skipped: true, link: existingLink };
  }

  const built = buildCalendarEvent(show, websiteOrigin);
  if (!built.ok) {
    return { ok: false, code: "no_date", message: built.message };
  }

  const permission = await writer.requestPermission();
  if (permission === "denied") {
    return {
      ok: false,
      code: "denied",
      message:
        "Calendar access is off. Enable it for ShowSignal in Settings, then try again.",
    };
  }
  if (permission !== "granted") {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not ask for calendar access. Try again.",
    };
  }

  try {
    const created = await writer.createEvent(built.payload);
    return {
      ok: true,
      skipped: false,
      link: {
        provider: "native",
        externalCalendarEventId: created.id,
        addedAt,
      },
    };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not add that concert to Calendar. Try again.",
    };
  }
}
