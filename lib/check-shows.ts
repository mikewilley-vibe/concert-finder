import { findNewEventIds, mergeEventIds } from "./find-new-event-ids";
import { chunkRows } from "./chunk-rows";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  type FollowedItemType,
} from "./saved-follows";
import { AdminConfigError, getSupabaseAdminClient } from "./supabase/admin-client";
import { searchFollowedEventIds } from "./ticketmaster";

const WATCH_STATE_TABLE = "ticketmaster_watch_state";
export const CHECK_BATCH_SIZE = 40;
export const CHECK_CONCURRENCY = 4;
export const CHECK_TIME_BUDGET_MS = 45_000;

type FollowedRow = {
  user_id: string;
  item_type: FollowedItemType;
  item_key: string;
  item_label: string;
  known_event_ids: string[];
  new_event_ids: string[];
  initialized_at: string | null;
};

type ItemResult = {
  checked: number;
  newEvents: number;
  failed: number;
  rateLimited: boolean;
};

export type CheckShowsSummary = {
  success: true;
  selected: number;
  checked: number;
  newEvents: number;
  failed: number;
  deferred: number;
  rateLimited: boolean;
};

function isFollowedType(value: string): value is FollowedItemType {
  return (
    value === FOLLOWED_ATTRACTION_TYPE || value === FOLLOWED_VENUE_TYPE
  );
}

function asIdList(value: string[] | null | undefined) {
  return Array.isArray(value)
    ? value.filter((id) => typeof id === "string" && id.trim())
    : [];
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
  const { data, error } = await admin.rpc("get_ticketmaster_watch_batch", {
    requested_limit: CHECK_BATCH_SIZE,
  });

  if (error) {
    throw error;
  }

  const rows: FollowedRow[] = [];
  for (const row of data ?? []) {
    const userId = typeof row.user_id === "string" ? row.user_id : "";
    const itemType = typeof row.item_type === "string" ? row.item_type : "";
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
      known_event_ids: asIdList(row.known_event_ids),
      new_event_ids: asIdList(row.new_event_ids),
      initialized_at:
        typeof row.initialized_at === "string" ? row.initialized_at : null,
    });
  }
  return rows;
}

async function updateWatchState(
  item: FollowedRow,
  values: {
    known_event_ids?: string[];
    new_event_ids?: string[];
    initialized_at?: string;
    last_error: string | null;
  },
) {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from(WATCH_STATE_TABLE)
    .update({
      ...values,
      last_checked_at: new Date().toISOString(),
    })
    .eq("user_id", item.user_id)
    .eq("item_type", item.item_type)
    .eq("item_key", item.item_key);

  if (error) {
    throw error;
  }
}

async function checkOne(item: FollowedRow): Promise<ItemResult> {
  const result = await searchFollowedEventIds({
    itemType: item.item_type,
    itemKey: item.item_key,
  });

  if (!result.ok) {
    await updateWatchState(item, { last_error: safeLastError(result) });
    return {
      checked: 0,
      newEvents: 0,
      failed: 1,
      rateLimited: result.status === 429,
    };
  }

  const now = new Date().toISOString();
  if (!item.initialized_at) {
    await updateWatchState(item, {
      known_event_ids: result.ids,
      new_event_ids: [],
      initialized_at: now,
      last_error: null,
    });
    return { checked: 1, newEvents: 0, failed: 0, rateLimited: false };
  }

  const discovered = findNewEventIds(item.known_event_ids, result.ids);
  await updateWatchState(item, {
    known_event_ids: mergeEventIds(item.known_event_ids, discovered),
    new_event_ids: mergeEventIds(item.new_event_ids, discovered),
    last_error: null,
  });
  return {
    checked: 1,
    newEvents: discovered.length,
    failed: 0,
    rateLimited: false,
  };
}

export async function runCheckShows(): Promise<CheckShowsSummary> {
  getSupabaseAdminClient();

  const startedAt = Date.now();
  const rows = await loadFollowedRows();
  let checked = 0;
  let newEvents = 0;
  let failed = 0;
  let attempted = 0;
  let rateLimited = false;

  for (const chunk of chunkRows(rows, CHECK_CONCURRENCY)) {
    if (Date.now() - startedAt >= CHECK_TIME_BUDGET_MS || rateLimited) {
      break;
    }

    const results = await Promise.all(chunk.map(checkOne));
    attempted += chunk.length;
    for (const result of results) {
      checked += result.checked;
      newEvents += result.newEvents;
      failed += result.failed;
      rateLimited ||= result.rateLimited;
    }
  }

  return {
    success: true,
    selected: rows.length,
    checked,
    newEvents,
    failed,
    deferred: rows.length - attempted,
    rateLimited,
  };
}

export { AdminConfigError };
