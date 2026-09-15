import type { TicketmasterShow } from "./api";

export const ATTENDANCE_STORAGE_KEY = "showsignal:v1:attendance";

export type AttendanceStatus = "interested" | "going";

export type CalendarProvider = "native" | "google";

export type CalendarLink = {
  provider: CalendarProvider;
  externalCalendarEventId: string;
  addedAt: number;
};

/**
 * One row per show. `status` is mutually exclusive Interested/Going, or null
 * when the user cleared attendance. A null status still keeps `calendar` so a
 * later I’m Going tap does not create a second native event.
 */
export type AttendanceRecord = {
  showId: string;
  status: AttendanceStatus | null;
  show: TicketmasterShow;
  updatedAt: number;
  calendar: CalendarLink | null;
};

export type AttendanceState = {
  records: Record<string, AttendanceRecord>;
};

export const EMPTY_ATTENDANCE_STATE: AttendanceState = { records: {} };

export function isAttendanceStatus(
  value: unknown,
): value is AttendanceStatus {
  return value === "interested" || value === "going";
}

export function isCalendarProvider(value: unknown): value is CalendarProvider {
  return value === "native" || value === "google";
}

function asFinite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseArtist(value: unknown): TicketmasterShow["attractions"][number] | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { id?: unknown; name?: unknown; image?: unknown };
  const id = optionalString(record.id);
  const name = optionalString(record.name);
  if (!id || !name) {
    return null;
  }
  const artist: TicketmasterShow["attractions"][number] = { id, name };
  const image = optionalString(record.image);
  if (image) artist.image = image;
  return artist;
}

function parseShowSnapshot(value: unknown): TicketmasterShow | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = optionalString(record.id);
  const name = optionalString(record.name);
  if (!id || !name) {
    return null;
  }

  const attractions = Array.isArray(record.attractions)
    ? record.attractions.flatMap((row) => {
        const artist = parseArtist(row);
        return artist ? [artist] : [];
      })
    : [];

  const show: TicketmasterShow = {
    id,
    name,
    dateLabel: optionalString(record.dateLabel) ?? "Date TBA",
    venueName: optionalString(record.venueName) ?? "",
    city: optionalString(record.city) ?? "",
    state: optionalString(record.state) ?? "",
    attractions,
    matchedLabels: Array.isArray(record.matchedLabels)
      ? record.matchedLabels.flatMap((item) => {
          const text = optionalString(item);
          return text ? [text] : [];
        })
      : [],
  };

  const assign = (key: keyof TicketmasterShow, raw: unknown) => {
    const text = optionalString(raw);
    if (text) {
      (show as Record<string, unknown>)[key] = text;
    }
  };

  assign("timeLabel", record.timeLabel);
  assign("localDate", record.localDate);
  assign("localTime", record.localTime);
  assign("startsAt", record.startsAt);
  assign("timezone", record.timezone);
  assign("doorTime", record.doorTime);
  assign("venueId", record.venueId);
  assign("venueAddress", record.venueAddress);
  assign("url", record.url);
  assign("image", record.image);
  assign("status", record.status);
  assign("statusLabel", record.statusLabel);
  assign("priceLabel", record.priceLabel);

  if (typeof record.venueLatitude === "number" && Number.isFinite(record.venueLatitude)) {
    show.venueLatitude = record.venueLatitude;
  }
  if (
    typeof record.venueLongitude === "number" &&
    Number.isFinite(record.venueLongitude)
  ) {
    show.venueLongitude = record.venueLongitude;
  }

  return show;
}

function parseCalendarLink(value: unknown): CalendarLink | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as {
    provider?: unknown;
    externalCalendarEventId?: unknown;
    addedAt?: unknown;
  };
  const externalCalendarEventId = optionalString(record.externalCalendarEventId);
  if (!isCalendarProvider(record.provider) || !externalCalendarEventId) {
    return null;
  }
  return {
    provider: record.provider,
    externalCalendarEventId,
    addedAt: asFinite(record.addedAt) || Date.now(),
  };
}

export function parseAttendanceState(raw: string | null): AttendanceState {
  if (!raw) {
    return { records: {} };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { records: {} };
    }
    const recordsValue = (parsed as { records?: unknown }).records;
    if (!recordsValue || typeof recordsValue !== "object") {
      return { records: {} };
    }

    const records: Record<string, AttendanceRecord> = {};
    for (const [key, row] of Object.entries(
      recordsValue as Record<string, unknown>,
    )) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const record = row as {
        showId?: unknown;
        status?: unknown;
        show?: unknown;
        updatedAt?: unknown;
        calendar?: unknown;
      };
      const showId = optionalString(record.showId) ?? optionalString(key);
      const show = parseShowSnapshot(record.show);
      if (!showId || !show || show.id !== showId) {
        continue;
      }
      const status = isAttendanceStatus(record.status) ? record.status : null;
      const calendar = parseCalendarLink(record.calendar);
      if (!status && !calendar) {
        continue;
      }
      records[showId] = {
        showId,
        status,
        show,
        updatedAt: asFinite(record.updatedAt) || Date.now(),
        calendar,
      };
    }
    return { records };
  } catch {
    return { records: {} };
  }
}

export function attendanceFor(
  state: AttendanceState,
  showId: string,
): AttendanceRecord | null {
  return state.records[showId] ?? null;
}

export function statusFor(
  state: AttendanceState,
  showId: string,
): AttendanceStatus | null {
  return state.records[showId]?.status ?? null;
}

export function calendarLinkFor(
  state: AttendanceState,
  showId: string,
): CalendarLink | null {
  return state.records[showId]?.calendar ?? null;
}

/**
 * Tapping the active control clears to neither. Tapping the other status
 * switches. Cards that should not clear on a second Going tap skip this.
 */
export function nextExclusiveStatus(
  current: AttendanceStatus | null,
  tapped: AttendanceStatus,
): AttendanceStatus | null {
  return current === tapped ? null : tapped;
}

export function hasCalendarEvent(link: CalendarLink | null | undefined) {
  return Boolean(link?.externalCalendarEventId);
}

export function shouldWriteCalendarEvent(
  link: CalendarLink | null | undefined,
) {
  return !hasCalendarEvent(link);
}

export function rememberCalendarLink(
  state: AttendanceState,
  showId: string,
  link: CalendarLink,
  show?: TicketmasterShow,
): AttendanceState {
  const existing = state.records[showId];
  if (
    existing?.calendar?.provider === link.provider &&
    existing.calendar.externalCalendarEventId === link.externalCalendarEventId
  ) {
    return state;
  }
  const snapshot = show ?? existing?.show;
  if (!snapshot) {
    return state;
  }
  return {
    records: {
      ...state.records,
      [showId]: {
        showId,
        status: existing?.status ?? null,
        show: { ...snapshot, id: showId },
        updatedAt: existing?.updatedAt ?? link.addedAt,
        calendar: link,
      },
    },
  };
}

export function applyAttendanceStatus(
  state: AttendanceState,
  show: TicketmasterShow,
  status: AttendanceStatus | null,
  at = Date.now(),
): AttendanceState {
  const showId = show.id.trim();
  if (!showId) {
    return state;
  }
  const existing = state.records[showId];
  const snapshot = existing
    ? { ...existing.show, ...show, id: showId }
    : { ...show, id: showId };
  const calendar = existing?.calendar ?? null;

  if (!status) {
    if (!existing) {
      return state;
    }
    if (!calendar?.externalCalendarEventId) {
      const records = { ...state.records };
      delete records[showId];
      return { records };
    }
    return {
      records: {
        ...state.records,
        [showId]: {
          showId,
          status: null,
          show: snapshot,
          updatedAt: at,
          calendar,
        },
      },
    };
  }

  return {
    records: {
      ...state.records,
      [showId]: {
        showId,
        status,
        show: snapshot,
        updatedAt: at,
        calendar,
      },
    },
  };
}

export function showsWithStatus(
  state: AttendanceState,
  status: AttendanceStatus,
) {
  return Object.values(state.records)
    .filter((record) => record.status === status)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((record) => record.show);
}

export function mergeAttendanceStates(
  local: AttendanceState,
  remote: AttendanceState,
): AttendanceState {
  const records: Record<string, AttendanceRecord> = { ...local.records };
  for (const [showId, remoteRecord] of Object.entries(remote.records)) {
    const localRecord = records[showId];
    if (!localRecord) {
      records[showId] = remoteRecord;
      continue;
    }
    const preferRemote = remoteRecord.updatedAt >= localRecord.updatedAt;
    records[showId] = {
      showId,
      status: preferRemote ? remoteRecord.status : localRecord.status,
      show: preferRemote ? remoteRecord.show : localRecord.show,
      updatedAt: Math.max(localRecord.updatedAt, remoteRecord.updatedAt),
      calendar: localRecord.calendar?.externalCalendarEventId
        ? localRecord.calendar
        : remoteRecord.calendar,
    };
  }
  return { records };
}
