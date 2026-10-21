import { getSupabaseAdminClient } from "./supabase/admin-client.ts";
import type { SuggestionActivity, SuggestionFollow, SuggestionShowFact } from "./suggestion-pills.ts";

const FOLLOWED_ARTIST = "ticketmaster_attraction";
const FOLLOWED_VENUE = "ticketmaster_venue";

type Library = {
  follows: { artists: SuggestionFollow[]; venues: SuggestionFollow[] };
  dismissed: { artists: SuggestionFollow[]; venues: SuggestionFollow[] };
  activity: { artists: SuggestionActivity[]; venues: SuggestionActivity[] };
  savedShows: Array<
    SuggestionShowFact & {
      latitude: number | null;
      longitude: number | null;
    }
  >;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asFollow(row: { item_key?: unknown; item_label?: unknown }): SuggestionFollow | null {
  const id = text(row.item_key);
  const name = text(row.item_label);
  if (!id || !name) {
    return null;
  }
  return { id, name };
}

function attractions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }
    const record = row as { id?: unknown; name?: unknown; imageUrl?: unknown };
    const id = text(record.id);
    const name = text(record.name);
    if (!id || !name) {
      return [];
    }
    const imageUrl = text(record.imageUrl);
    return [{ id, name, imageUrl: imageUrl || null }];
  });
}

export async function loadSuggestionLibrary(userId: string): Promise<Library> {
  const admin = getSupabaseAdminClient();
  const [followsResult, dismissedResult, savedResult] = await Promise.all([
    admin
      .from("saved_items")
      .select("item_type, item_key, item_label")
      .eq("user_id", userId)
      .in("item_type", [FOLLOWED_ARTIST, FOLLOWED_VENUE]),
    admin
      .from("suggestion_dismissals")
      .select("item_type, item_key, item_label")
      .eq("user_id", userId),
    admin
      .from("saved_events")
      .select(
        "venue_id, venue_name, city, state, attractions, attendance_status, local_date, venue_latitude, venue_longitude",
      )
      .eq("user_id", userId)
      .eq("provider", "ticketmaster")
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  const follows = { artists: [] as SuggestionFollow[], venues: [] as SuggestionFollow[] };
  if (!followsResult.error) {
    for (const row of followsResult.data ?? []) {
      const item = asFollow(row);
      if (!item) {
        continue;
      }
      if (row.item_type === FOLLOWED_ARTIST) {
        follows.artists.push(item);
      } else if (row.item_type === FOLLOWED_VENUE) {
        follows.venues.push(item);
      }
    }
  }

  const dismissed = { artists: [] as SuggestionFollow[], venues: [] as SuggestionFollow[] };
  if (!dismissedResult.error) {
    for (const row of dismissedResult.data ?? []) {
      const item = asFollow(row);
      if (!item) {
        continue;
      }
      if (row.item_type === FOLLOWED_ARTIST) {
        dismissed.artists.push(item);
      } else if (row.item_type === FOLLOWED_VENUE) {
        dismissed.venues.push(item);
      }
    }
  }

  const activity = {
    artists: [] as SuggestionActivity[],
    venues: [] as SuggestionActivity[],
  };
  const savedShows: Library["savedShows"] = [];
  if (!savedResult.error) {
    for (const row of savedResult.data ?? []) {
      const signal = row.attendance_status === "going" ? "going" : "interested";
      const artistsOnShow = attractions(row.attractions);
      for (const artist of artistsOnShow) {
        activity.artists.push({ ...artist, signal });
      }
      const venueId = text(row.venue_id);
      const venueName = text(row.venue_name);
      if (venueId && venueName) {
        activity.venues.push({ id: venueId, name: venueName, signal });
      }
      savedShows.push({
        id: `${venueId || "saved"}:${text(row.local_date)}:${artistsOnShow[0]?.id ?? venueName}`,
        localDate: text(row.local_date) || null,
        city: text(row.city) || null,
        state: text(row.state) || null,
        venueId: venueId || null,
        venueName: venueName || null,
        attractions: artistsOnShow,
        latitude: numberOrNull(row.venue_latitude),
        longitude: numberOrNull(row.venue_longitude),
      });
    }
  }

  return { follows, dismissed, activity, savedShows };
}
