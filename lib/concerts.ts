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
};

function parseEventDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
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
  };
}

export async function loadConcerts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("concerts")
    .select("id, artist, venue, city, event_date, description, created_at")
    .order("event_date", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    concertRowToItem({
      id: String(row.id),
      artist: String(row.artist ?? ""),
      venue: String(row.venue ?? ""),
      city: String(row.city ?? ""),
      event_date: String(row.event_date ?? ""),
      description:
        typeof row.description === "string" ? row.description : null,
      created_at: String(row.created_at ?? ""),
    }),
  );
}
