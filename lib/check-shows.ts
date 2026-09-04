import { chunkRows } from "./chunk-rows";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  type FollowedItemType,
} from "./saved-follows";
import { AdminConfigError, getSupabaseAdminClient } from "./supabase/admin-client";
import { searchFollowedEventIds } from "./ticketmaster";

export const CHECK_BATCH_SIZE = 40;
export const CHECK_CONCURRENCY = 4;
export const CHECK_TIME_BUDGET_MS = 45_000;

type FollowedRow = {
  user_id: string;
  item_type: FollowedItemType;
  item_key: string;
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
    if (!userId || !itemKey || !isFollowedType(itemType)) {
      continue;
    }
    rows.push({
      user_id: userId,
      item_type: itemType,
      item_key: itemKey,
    });
  }
  return rows;
}

function asApplyResult(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { checked: 0, newEvents: 0 };
  }

  const row = data as { checked?: unknown; new_events?: unknown };
  return {
    checked: typeof row.checked === "number" ? row.checked : 0,
    newEvents: typeof row.new_events === "number" ? row.new_events : 0,
  };
}

async function applyWatchCheck(
  item: FollowedRow,
  values: {
    discoveredEventIds?: string[];
    checkError?: string | null;
  },
) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("apply_ticketmaster_watch_check", {
    target_user_id: item.user_id,
    target_item_type: item.item_type,
    target_item_key: item.item_key,
    discovered_event_ids: values.discoveredEventIds ?? [],
    check_error: values.checkError ?? null,
  });

  if (error) {
    throw error;
  }

  return asApplyResult(data);
}

async function checkOne(item: FollowedRow): Promise<ItemResult> {
  const result = await searchFollowedEventIds({
    itemType: item.item_type,
    itemKey: item.item_key,
  });

  if (!result.ok) {
    await applyWatchCheck(item, { checkError: safeLastError(result) });
    return {
      checked: 0,
      newEvents: 0,
      failed: 1,
      rateLimited: result.status === 429,
    };
  }

  const applied = await applyWatchCheck(item, {
    discoveredEventIds: result.ids,
  });
  return {
    checked: applied.checked,
    newEvents: applied.newEvents,
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
