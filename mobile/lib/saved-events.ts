import type { SupabaseClient } from "@supabase/supabase-js";

import type { TicketmasterShow } from "./api";
import { notifyUserLibraryChanged } from "./sync";

type SavedEventRow = {
  provider_event_id: unknown;
  name: unknown;
  date_label: unknown;
  time_label: unknown;
  venue_name: unknown;
  city: unknown;
  state: unknown;
  image_url: unknown;
  ticket_url: unknown;
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
  const image = optionalString(raw.image_url);
  const url = optionalString(raw.ticket_url);
  if (timeLabel) show.timeLabel = timeLabel;
  if (image) show.image = image;
  if (url) show.url = url;
  return show;
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

export async function saveTicketmasterEvent(
  supabase: SupabaseClient,
  userId: string,
  show: TicketmasterShow,
) {
  // Phase 1 live columns only. Production does not yet have Phase 2 fields
  // such as venue_id, date_status, or attractions.
  const { error } = await supabase.from("saved_events").upsert(
    {
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
    },
    { onConflict: "user_id,provider,provider_event_id" },
  );

  if (error) {
    throw error;
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
