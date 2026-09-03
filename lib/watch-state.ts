import type { AppSupabaseClient } from "./supabase/database.types";

export const WATCH_STATE_TABLE = "ticketmaster_watch_state";

export type WatchStateRow = {
  id: string;
  item_label: string;
  item_type: string;
  new_event_ids: string[];
  last_checked_at: string | null;
  initialized_at: string | null;
};

function asIdList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
}

export async function loadOwnWatchState(supabase: AppSupabaseClient) {
  const { data, error } = await supabase
    .from(WATCH_STATE_TABLE)
    .select("id, item_label, item_type, new_event_ids, last_checked_at, initialized_at")
    .order("last_checked_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    item_label:
      typeof row.item_label === "string" && row.item_label.trim()
        ? row.item_label.trim()
        : "Followed item",
    item_type: typeof row.item_type === "string" ? row.item_type : "",
    new_event_ids: asIdList(row.new_event_ids),
    last_checked_at:
      typeof row.last_checked_at === "string" ? row.last_checked_at : null,
    initialized_at:
      typeof row.initialized_at === "string" ? row.initialized_at : null,
  })) satisfies WatchStateRow[];
}

export async function markOwnWatchStateSeen(
  supabase: AppSupabaseClient,
  rowId: string,
) {
  const { error } = await supabase.rpc(
    "mark_ticketmaster_watch_state_seen",
    { target_id: rowId },
  );

  if (error) {
    throw error;
  }
}

export function uniqueNewEventIds(rows: WatchStateRow[]) {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const id of row.new_event_ids) {
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function latestCheckedAt(rows: WatchStateRow[]) {
  const times = rows
    .map((row) => row.last_checked_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return times.at(-1) ?? null;
}
