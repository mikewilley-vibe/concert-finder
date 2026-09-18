import type { SupabaseClient } from "@supabase/supabase-js";

import type { TicketmasterShow } from "./api";
import {
  isAttendanceStatus,
  isCalendarProvider,
  type AttendanceRecord,
  type AttendanceState,
  type AttendanceStatus,
  type CalendarLink,
} from "./attendance";
import { notifyUserLibraryChanged } from "./sync";

type SavedEventRow = {
  provider_event_id: unknown;
  name: unknown;
  date_label: unknown;
  time_label: unknown;
  local_date: unknown;
  local_time: unknown;
  starts_at: unknown;
  timezone: unknown;
  venue_name: unknown;
  venue_address_line: unknown;
  city: unknown;
  state: unknown;
  image_url: unknown;
  ticket_url: unknown;
  venue_id: unknown;
  attendance_status: unknown;
  calendar_provider: unknown;
  external_calendar_event_id: unknown;
  calendar_added_at: unknown;
  updated_at: unknown;
  created_at: unknown;
};

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function rowToShow(raw: SavedEventRow): TicketmasterShow | null {
  const id = optionalString(raw.provider_event_id);
  const name = optionalString(raw.name);
  if (!id || !name) {
    return null;
  }

  const show: TicketmasterShow = {
    id,
    name,
    dateLabel: optionalString(raw.date_label) ?? "Date TBA",
    venueName: optionalString(raw.venue_name) ?? "",
    city: optionalString(raw.city) ?? "",
    state: optionalString(raw.state) ?? "",
    attractions: [],
    matchedLabels: [],
  };
  const timeLabel = optionalString(raw.time_label);
  const localDate = optionalString(raw.local_date);
  const localTime = optionalString(raw.local_time);
  const startsAt = optionalString(raw.starts_at);
  const timezone = optionalString(raw.timezone);
  const venueAddress = optionalString(raw.venue_address_line);
  const venueId = optionalString(raw.venue_id);
  const image = optionalString(raw.image_url);
  const url = optionalString(raw.ticket_url);
  if (timeLabel) show.timeLabel = timeLabel;
  if (localDate) show.localDate = localDate;
  if (localTime) show.localTime = localTime;
  if (startsAt) show.startsAt = startsAt;
  if (timezone) show.timezone = timezone;
  if (venueAddress) show.venueAddress = venueAddress;
  if (venueId) show.venueId = venueId;
  if (image) show.image = image;
  if (url) show.url = url;
  return show;
}

function rowCalendarLink(raw: SavedEventRow): CalendarLink | null {
  const provider = raw.calendar_provider;
  const eventId = optionalString(raw.external_calendar_event_id);
  if (!isCalendarProvider(provider) || !eventId) {
    return null;
  }
  const addedAtRaw = optionalString(raw.calendar_added_at);
  const addedAt = addedAtRaw ? Date.parse(addedAtRaw) : NaN;
  return {
    provider,
    externalCalendarEventId: eventId,
    addedAt: Number.isFinite(addedAt) ? addedAt : Date.now(),
  };
}

function rowUpdatedAt(raw: SavedEventRow) {
  const stamp = optionalString(raw.updated_at) ?? optionalString(raw.created_at);
  const parsed = stamp ? Date.parse(stamp) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rowToAttendanceRecord(raw: SavedEventRow): AttendanceRecord | null {
  const show = rowToShow(raw);
  if (!show) {
    return null;
  }
  const status = isAttendanceStatus(raw.attendance_status)
    ? raw.attendance_status
    : "interested";
  return {
    showId: show.id,
    status,
    show,
    updatedAt: rowUpdatedAt(raw),
    calendar: rowCalendarLink(raw),
  };
}

function snapshotRow(userId: string, show: TicketmasterShow) {
  return {
    user_id: userId,
    provider: "ticketmaster",
    provider_event_id: show.id,
    name: show.name,
    date_label: show.dateLabel,
    time_label: show.timeLabel ?? null,
    venue_name: show.venueName,
    city: show.city,
    state: show.state,
    image_url: show.image ?? null,
    ticket_url: show.url ?? null,
  };
}

function extendedSnapshot(userId: string, show: TicketmasterShow) {
  return {
    ...snapshotRow(userId, show),
    local_date: show.localDate ?? null,
    local_time: show.localTime ?? null,
    starts_at: show.startsAt ?? null,
    timezone: show.timezone ?? null,
    venue_address_line: show.venueAddress ?? null,
  };
}

export function isMissingColumnError(error: { message?: string; code?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    message.includes("attendance_status") ||
    message.includes("calendar_provider") ||
    message.includes("external_calendar_event_id") ||
    message.includes("calendar_added_at") ||
    message.includes("venue_id") ||
    message.includes("venue_address") ||
    message.includes("updated_at") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

export async function loadSavedTicketmasterEventIds(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("saved_events")
    .select("provider_event_id")
    .eq("provider", "ticketmaster");

  if (error) {
    throw error;
  }

  return new Set(
    (data ?? [])
      .map((row) => optionalString(row.provider_event_id))
      .filter((id): id is string => Boolean(id)),
  );
}

export async function loadSavedTicketmasterEvents(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("saved_events")
    .select(
      "provider_event_id, name, date_label, time_label, local_date, local_time, starts_at, timezone, venue_name, venue_address_line, city, state, image_url, ticket_url, venue_id, attendance_status, calendar_provider, external_calendar_event_id, calendar_added_at, updated_at, created_at",
    )
    .eq("provider", "ticketmaster")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingColumnError(error)) {
      return loadSavedTicketmasterEventsLegacy(supabase);
    }
    throw error;
  }

  return (data ?? []).flatMap((raw) => {
    const show = rowToShow(raw as SavedEventRow);
    return show ? [show] : [];
  });
}

async function loadSavedTicketmasterEventsLegacy(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("saved_events")
    .select(
      "provider_event_id, name, date_label, time_label, venue_name, city, state, image_url, ticket_url",
    )
    .eq("provider", "ticketmaster")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).flatMap((raw) => {
    const show = rowToShow(raw as SavedEventRow);
    return show ? [show] : [];
  });
}

export async function loadAttendanceState(
  supabase: SupabaseClient,
): Promise<AttendanceState> {
  const { data, error } = await supabase
    .from("saved_events")
    .select(
      "provider_event_id, name, date_label, time_label, local_date, local_time, starts_at, timezone, venue_name, venue_address_line, city, state, image_url, ticket_url, venue_id, attendance_status, calendar_provider, external_calendar_event_id, calendar_added_at, updated_at, created_at",
    )
    .eq("provider", "ticketmaster")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingColumnError(error)) {
      const shows = await loadSavedTicketmasterEventsLegacy(supabase);
      const records: AttendanceState["records"] = {};
      for (const show of shows) {
        records[show.id] = {
          showId: show.id,
          status: "interested",
          show,
          updatedAt: Date.now(),
          calendar: null,
        };
      }
      return { records };
    }
    throw error;
  }

  const records: AttendanceState["records"] = {};
  for (const raw of data ?? []) {
    const record = rowToAttendanceRecord(raw as SavedEventRow);
    if (record) {
      records[record.showId] = record;
    }
  }
  return { records };
}

export async function saveTicketmasterEvent(
  supabase: SupabaseClient,
  userId: string,
  show: TicketmasterShow,
  extras?: {
    attendanceStatus?: AttendanceStatus;
    calendar?: CalendarLink | null;
  },
) {
  const attendanceStatus = extras?.attendanceStatus ?? "interested";
  const calendar = extras?.calendar;
  const fullRow: Record<string, unknown> = {
    ...extendedSnapshot(userId, show),
    attendance_status: attendanceStatus,
  };
  if (calendar?.externalCalendarEventId) {
    fullRow.calendar_provider = calendar.provider;
    fullRow.external_calendar_event_id = calendar.externalCalendarEventId;
    fullRow.calendar_added_at = new Date(calendar.addedAt).toISOString();
  }

  const { error } = await supabase.from("saved_events").upsert(fullRow, {
    onConflict: "user_id,provider,provider_event_id",
  });

  if (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    const { error: fallbackError } = await supabase.from("saved_events").upsert(
      snapshotRow(userId, show),
      { onConflict: "user_id,provider,provider_event_id" },
    );
    if (fallbackError) {
      throw fallbackError;
    }
  }

  notifyUserLibraryChanged();
}

export async function unsaveTicketmasterEvent(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
) {
  const { error } = await supabase
    .from("saved_events")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "ticketmaster")
    .eq("provider_event_id", eventId);

  if (error) {
    throw error;
  }

  notifyUserLibraryChanged();
}

export async function updateSavedEventCalendar(
  supabase: SupabaseClient,
  userId: string,
  eventId: string,
  calendar: CalendarLink,
) {
  const { error } = await supabase
    .from("saved_events")
    .update({
      calendar_provider: calendar.provider,
      external_calendar_event_id: calendar.externalCalendarEventId,
      calendar_added_at: new Date(calendar.addedAt).toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "ticketmaster")
    .eq("provider_event_id", eventId);

  if (error && !isMissingColumnError(error)) {
    throw error;
  }
}
