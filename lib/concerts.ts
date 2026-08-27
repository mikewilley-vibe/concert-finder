import type { SupabaseClient } from "@supabase/supabase-js";
import type { SampleItem } from "../data/sample-items";

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

export type ConcertSubmission = {
  artist: string;
  venue: string;
  city: string;
  event_date: string | null;
  description: string | null;
};

const CONCERT_SELECT =
  "id, artist, venue, city, event_date, description, created_at, is_published";

function parseEventDate(value: string) {
  const day = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Date(`${day}T12:00:00`);
  }

  return new Date(value);
}

export function concertRowToItem(row: ConcertRow): SampleItem {
  const date = parseEventDate(row.event_date);
  const valid = !Number.isNaN(date.getTime());
  const description = row.description?.trim() || "Details coming soon.";
  const place = [row.venue, row.city].filter(Boolean).join(" · ");

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
      : "—",
    day: valid ? String(date.getDate()) : "–",
    weekday: valid
      ? date.toLocaleDateString("en-US", { weekday: "short" })
      : "",
    genre: "",
    note: description,
    details: description,
    published: row.is_published === true,
  };
}

function mapConcertRow(row: Record<string, unknown>): SampleItem {
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

export async function loadConcerts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("concerts")
    .select(CONCERT_SELECT)
    .order("event_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapConcertRow(row));
}

export async function submitConcert(
  supabase: SupabaseClient,
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
