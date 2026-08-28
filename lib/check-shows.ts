import { isPermanentUser } from "./account";
import {
  findNewEventIds,
  mergeEventIds,
} from "./find-new-event-ids";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  type FollowedItemType,
} from "./saved-follows";
import { AdminConfigError, getSupabaseAdminClient } from "./supabase/admin-client";
import {
  MAX_FOLLOWED_IDS,
  searchFollowedEventIds,
} from "./ticketmaster";

const WATCH_STATE_TABLE = "ticketmaster_watch_state";

type FollowedRow = {
  user_id: string;
  item_type: FollowedItemType;
  item_key: string;
  item_label: string;
};

type WatchStateRow = {
  known_event_ids: string[] | null;
  new_event_ids: string[] | null;
};

export type CheckShowsSummary = {
  success: true;
  checked: number;
  newEvents: number;
};

function isFollowedType(value: string): value is FollowedItemType {
  return (
    value === FOLLOWED_ATTRACTION_TYPE || value === FOLLOWED_VENUE_TYPE
  );
}

function asIdList(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

function safeLastError(result: { status: number; cause?: "auth" | "rate_limit" }) {
  if (result.cause === "rate_limit" || result.status === 429) {
    return "Ticketmaster returned 429";
  }
  if (result.cause === "auth") {
    return "Ticketmaster API key is not set up correctly";
  }
  return "Unable to read event results";
}

async function loadFollowedRows() {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("saved_items")
    .select("user_id, item_type, item_key, item_label")
    .in("item_type", [FOLLOWED_ATTRACTION_TYPE, FOLLOWED_VENUE_TYPE]);

  if (error) {
    throw error;
  }

  const rows: FollowedRow[] = [];
  for (const row of data ?? []) {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    const itemType =
      typeof row.item_type === "string" ? row.item_type : "";
    const itemKey = typeof row.item_key === "string" ? row.item_key.trim() : "";
    const itemLabel =
      typeof row.item_label === "string" ? row.item_label.trim() : itemKey;
    if (!userId || !itemKey || !isFollowedType(itemType)) {
      continue;
    }
    rows.push({
      user_id: userId,
      item_type: itemType,
      item_key: itemKey,
      item_label: itemLabel || itemKey,
    });
  }
  return rows;
}

function groupByUser(rows: FollowedRow[]) {
  const grouped = new Map<string, FollowedRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.user_id) ?? [];
    if (list.length < MAX_FOLLOWED_IDS) {
      list.push(row);
    }
    grouped.set(row.user_id, list);
  }
  return grouped;
}

async function isPermanentAccount(userId: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return false;
  }
  return isPermanentUser(data.user);
}

async function loadWatchState(item: FollowedRow) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from(WATCH_STATE_TABLE)
    .select("known_event_ids, new_event_ids")
    .eq("user_id", item.user_id)
    .eq("item_type", item.item_type)
    .eq("item_key", item.item_key)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as WatchStateRow | null) ?? null;
}

async function recordItemError(item: FollowedRow, lastError: string) {
  const admin = getSupabaseAdminClient();
  const existing = await loadWatchState(item);
  if (!existing) {
    return;
  }

  const { error } = await admin
    .from(WATCH_STATE_TABLE)
    .update({
      last_error: lastError,
      last_checked_at: new Date().toISOString(),
    })
    .eq("user_id", item.user_id)
    .eq("item_type", item.item_type)
    .eq("item_key", item.item_key);

  if (error) {
    throw error;
  }
}

async function saveBaseline(item: FollowedRow, currentIds: string[]) {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from(WATCH_STATE_TABLE).insert({
    user_id: item.user_id,
    item_type: item.item_type,
    item_key: item.item_key,
    item_label: item.item_label,
    known_event_ids: currentIds,
    new_event_ids: [],
    initialized_at: now,
    last_checked_at: now,
    last_error: null,
  });

  if (error) {
    throw error;
  }
}

async function saveLaterRun(
  item: FollowedRow,
  knownIds: string[],
  newEventIds: string[],
) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from(WATCH_STATE_TABLE)
    .update({
      known_event_ids: knownIds,
      new_event_ids: newEventIds,
      last_checked_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("user_id", item.user_id)
    .eq("item_type", item.item_type)
    .eq("item_key", item.item_key);

  if (error) {
    throw error;
  }
}

export async function runCheckShows(): Promise<CheckShowsSummary> {
  getSupabaseAdminClient();

  const grouped = groupByUser(await loadFollowedRows());
  let checked = 0;
  let newEvents = 0;

  for (const [userId, items] of grouped) {
    const permanent = await isPermanentAccount(userId);
    if (!permanent) {
      continue;
    }

    for (const item of items) {
      const result = await searchFollowedEventIds({
        itemType: item.item_type,
        itemKey: item.item_key,
      });

      if (!result.ok) {
        await recordItemError(item, safeLastError(result));
        if (result.status === 429) {
          return { success: true, checked, newEvents };
        }
        continue;
      }

      const currentIds = result.ids;
      const existing = await loadWatchState(item);

      if (!existing) {
        await saveBaseline(item, currentIds);
        checked += 1;
        continue;
      }

      const knownIds = asIdList(existing.known_event_ids);
      const alreadyNew = asIdList(existing.new_event_ids);
      const discovered = findNewEventIds(knownIds, currentIds);
      await saveLaterRun(
        item,
        mergeEventIds(knownIds, discovered),
        mergeEventIds(alreadyNew, discovered),
      );
      checked += 1;
      newEvents += discovered.length;
    }
  }

  return { success: true, checked, newEvents };
}

export { AdminConfigError };
