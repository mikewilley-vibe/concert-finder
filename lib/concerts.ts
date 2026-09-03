import type { ListingItem } from "./listing-item";
import type { AppSupabaseClient } from "./supabase/database.types";

export type ConcertRow = {
  id: string;
  artist: string;
  venue: string;
  city: string;
  event_date: string;
  description: string | null;
  created_at: string;
  is_published: boolean;
};

export type ManagedConcert = {
  id: string;
  artist: string;
  venue: string;
  city: string;
  event_date: string;
  description: string;
  is_published: boolean;
};

export type ConcertSubmission = {
  artist: string;
  venue: string;
  city: string;
  event_date: string | null;
  description: string | null;
};

const CONCERT_SELECT =
  "id, artist, venue, city, event_date, description, created_at, is_published";
const OWN_CONCERT_SELECT = `${CONCERT_SELECT}, created_by`;

function parseEventDate(value: string) {
  const day = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Date(`${day}T12:00:00`);
  }

  return new Date(value);
}

export function concertRowToItem(row: ConcertRow): ListingItem {
  const date = parseEventDate(row.event_date);
  const valid = !Number.isNaN(date.getTime());
  const description = row.description?.trim() || "Details coming soon.";
  const place = [row.venue, row.city].filter(Boolean).join(" \u00b7 ");

  return {
    id: String(row.id),
    kind: "concert",
    title: row.artist,
    place,
    dateLabel: valid
      ? date.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : row.event_date,
    month: valid
      ? date.toLocaleDateString("en-US", { month: "short" })
      : "\u2014",
    day: valid ? String(date.getDate()) : "\u2013",
    weekday: valid
      ? date.toLocaleDateString("en-US", { weekday: "short" })
      : "",
    genre: "",
    note: description,
    details: description,
    published: row.is_published === true,
  };
}

function eventDateInputValue(value: string) {
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

function mapManagedConcert(row: Record<string, unknown>): ManagedConcert {
  return {
    id: String(row.id),
    artist: String(row.artist ?? ""),
    venue: String(row.venue ?? ""),
    city: String(row.city ?? ""),
    event_date: eventDateInputValue(String(row.event_date ?? "")),
    description:
      typeof row.description === "string" ? row.description : "",
    is_published: row.is_published === true,
  };
}

function mapConcertRow(row: Record<string, unknown>): ListingItem {
  return concertRowToItem({
    id: String(row.id),
    artist: String(row.artist ?? ""),
    venue: String(row.venue ?? ""),
    city: String(row.city ?? ""),
    event_date: String(row.event_date ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    created_at: String(row.created_at ?? ""),
    is_published: row.is_published === true,
  });
}

function deniedError() {
  const error = new Error("Could not change this concert.");
  (error as Error & { code?: string }).code = "42501";
  return error;
}

export async function loadConcerts(supabase: AppSupabaseClient) {
  const { data, error } = await supabase
    .from("concerts")
    .select(CONCERT_SELECT)
    .order("event_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapConcertRow(row));
}

export async function loadOwnConcerts(
  supabase: AppSupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("concerts")
    .select(OWN_CONCERT_SELECT)
    .eq("created_by", userId)
    .order("event_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row) => String(row.created_by) === userId)
    .map((row) => mapManagedConcert(row));
}

export async function updateOwnDraft(
  supabase: AppSupabaseClient,
  id: string,
  input: ConcertSubmission,
) {
  const { data, error } = await supabase
    .from("concerts")
    .update({
      artist: input.artist,
      venue: input.venue,
      city: input.city,
      event_date: input.event_date,
      description: input.description,
    })
    .eq("id", id)
    .eq("is_published", false)
    .select(OWN_CONCERT_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw deniedError();
  }

  return mapManagedConcert(data as Record<string, unknown>);
}

export async function deleteOwnDraft(supabase: AppSupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("concerts")
    .delete()
    .eq("id", id)
    .eq("is_published", false)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw deniedError();
  }
}

export async function submitConcert(
  supabase: AppSupabaseClient,
  userId: string,
  input: ConcertSubmission,
) {
  const { data, error } = await supabase
    .from("concerts")
    .insert({
      artist: input.artist,
      venue: input.venue,
      city: input.city,
      event_date: input.event_date,
      description: input.description,
      created_by: userId,
      is_published: false,
    })
    .select(CONCERT_SELECT)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Concert was submitted but could not be loaded.");
  }

  return mapConcertRow(data as Record<string, unknown>);
}
