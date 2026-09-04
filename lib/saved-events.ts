import type { ArtistSummary, ConcertEvent } from "../shared/api/v1";
import type { AppSupabaseClient } from "./supabase/database.types";

export const SAVED_EVENTS_CHANGED_EVENT = "my-shows:saved-events-changed";

type SavedEventRow = {
  provider_event_id: unknown;
  name: unknown;
  date_label: unknown;
  time_label: unknown;
  venue_name: unknown;
  city: unknown;
  state: unknown;
  venue_state_code: unknown;
  starts_at: unknown;
  local_date: unknown;
  local_time: unknown;
  timezone: unknown;
  date_status: unknown;
  image_url: unknown;
  ticket_url: unknown;
  event_status: unknown;
  sale_starts_at: unknown;
  sale_ends_at: unknown;
  venue_id: unknown;
  venue_address_line: unknown;
  venue_postal_code: unknown;
  venue_country_code: unknown;
  venue_latitude: unknown;
  venue_longitude: unknown;
  attractions: unknown;
  matched_labels: unknown;
};

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function artistSnapshots(value: unknown): ArtistSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }
    const record = row as { id?: unknown; name?: unknown; imageUrl?: unknown };
    const id = optionalString(record.id);
    const name = optionalString(record.name);
    if (!id || !name) {
      return [];
    }
    return [
      {
        id,
        name,
        imageUrl: optionalString(record.imageUrl) ?? null,
      },
    ];
  });
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const text = optionalString(item);
        return text ? [text] : [];
      })
    : [];
}

function notifySavedEventsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SAVED_EVENTS_CHANGED_EVENT));
  }
}

export async function loadSavedTicketmasterEventIds(
  supabase: AppSupabaseClient,
) {
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

export async function loadSavedTicketmasterEvents(
  supabase: AppSupabaseClient,
) {
  const { data, error } = await supabase
    .from("saved_events")
    .select(
      "provider_event_id, name, starts_at, local_date, local_time, timezone, date_status, date_label, time_label, venue_id, venue_name, venue_address_line, city, state, venue_state_code, venue_postal_code, venue_country_code, venue_latitude, venue_longitude, image_url, ticket_url, event_status, sale_starts_at, sale_ends_at, attractions, matched_labels",
    )
    .eq("provider", "ticketmaster")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).flatMap((raw) => {
    const row = raw as SavedEventRow;
    const id = optionalString(row.provider_event_id);
    const name = optionalString(row.name);
    if (!id || !name) {
      return [];
    }

    const localDate = optionalString(row.local_date) ?? null;
    const localTime = optionalString(row.local_time) ?? null;
    const saleStartsAt = optionalString(row.sale_starts_at) ?? null;
    const saleEndsAt = optionalString(row.sale_ends_at) ?? null;
    const show: ConcertEvent = {
      id,
      name,
      startsAt: optionalString(row.starts_at) ?? null,
      localDate,
      localTime,
      timezone: optionalString(row.timezone) ?? null,
      dateStatus:
        row.date_status === "date_tba" || row.date_status === "date_tbd"
          ? row.date_status
          : "scheduled",
      dateLabel: optionalString(row.date_label) ?? "Date TBA",
      timeLabel: optionalString(row.time_label) ?? null,
      status: optionalString(row.event_status) ?? null,
      imageUrl: optionalString(row.image_url) ?? null,
      ticketUrl: optionalString(row.ticket_url) ?? null,
      venue: {
        id: optionalString(row.venue_id) ?? "",
        name: optionalString(row.venue_name) ?? "",
        addressLine: optionalString(row.venue_address_line) ?? null,
        city: optionalString(row.city) ?? null,
        state: optionalString(row.state) ?? null,
        stateCode: optionalString(row.venue_state_code) ?? null,
        postalCode: optionalString(row.venue_postal_code) ?? null,
        countryCode: optionalString(row.venue_country_code) ?? null,
        timezone: optionalString(row.timezone) ?? null,
        latitude: optionalNumber(row.venue_latitude),
        longitude: optionalNumber(row.venue_longitude),
      },
      attractions: artistSnapshots(row.attractions),
      matchedLabels: stringList(row.matched_labels),
      sales:
        saleStartsAt || saleEndsAt
          ? { startsAt: saleStartsAt, endsAt: saleEndsAt }
          : null,
    };
    return [show];
  });
}

export async function saveTicketmasterEvent(
  supabase: AppSupabaseClient,
  userId: string,
  show: ConcertEvent,
) {
  const { error } = await supabase.from("saved_events").upsert(
    {
      user_id: userId,
      provider: "ticketmaster",
      provider_event_id: show.id,
      name: show.name,
      starts_at: show.startsAt,
      local_date: show.localDate,
      local_time: show.localTime,
      timezone: show.timezone,
      date_status: show.dateStatus,
      date_label: show.dateLabel,
      time_label: show.timeLabel,
      venue_id: show.venue.id || null,
      venue_name: show.venue.name,
      venue_address_line: show.venue.addressLine,
      city: show.venue.city ?? "",
      state: show.venue.state ?? show.venue.stateCode ?? "",
      venue_state_code: show.venue.stateCode,
      venue_postal_code: show.venue.postalCode,
      venue_country_code: show.venue.countryCode,
      venue_latitude: show.venue.latitude,
      venue_longitude: show.venue.longitude,
      image_url: show.imageUrl,
      ticket_url: show.ticketUrl,
      event_status: show.status,
      sale_starts_at: show.sales?.startsAt ?? null,
      sale_ends_at: show.sales?.endsAt ?? null,
      attractions: show.attractions,
      matched_labels: show.matchedLabels,
    },
    { onConflict: "user_id,provider,provider_event_id" },
  );

  if (error) {
    throw error;
  }
  notifySavedEventsChanged();
}

export async function unsaveTicketmasterEvent(
  supabase: AppSupabaseClient,
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
  notifySavedEventsChanged();
}
