import type { SupabaseClient } from "@supabase/supabase-js";

import { notifyUserLibraryChanged } from "./sync";

export const FOLLOWED_ATTRACTION_TYPE = "ticketmaster_attraction";
export const FOLLOWED_VENUE_TYPE = "ticketmaster_venue";
export const MAX_MONITORED_FOLLOWS = 8;

export type FollowedItemType =
  | typeof FOLLOWED_ATTRACTION_TYPE
  | typeof FOLLOWED_VENUE_TYPE;

export type FollowedItem = {
  item_key: string;
  item_label: string;
};

function asFollowedItem(row: {
  item_key: unknown;
  item_label: unknown;
}): FollowedItem | null {
  const item_key = typeof row.item_key === "string" ? row.item_key.trim() : "";
  const item_label =
    typeof row.item_label === "string" ? row.item_label.trim() : "";
  if (!item_key || !item_label) {
    return null;
  }
  return { item_key, item_label };
}

export function toFollowedRef(item: FollowedItem) {
  return { id: item.item_key, label: item.item_label };
}

export async function loadFollowedItems(
  supabase: SupabaseClient,
  itemType: FollowedItemType,
) {
  const { data, error } = await supabase
    .from("saved_items")
    .select("item_key, item_label")
    .eq("item_type", itemType)
    .order("item_label", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => asFollowedItem(row))
    .filter((row): row is FollowedItem => Boolean(row));
}

export async function followItem(
  supabase: SupabaseClient,
  userId: string,
  itemType: FollowedItemType,
  item: FollowedItem,
) {
  const { error } = await supabase.from("saved_items").insert({
    user_id: userId,
    item_key: item.item_key,
    item_label: item.item_label,
    item_type: itemType,
  });

  if (error && error.code !== "23505") {
    throw error;
  }

  notifyUserLibraryChanged();
}

export async function unfollowItem(
  supabase: SupabaseClient,
  userId: string,
  itemType: FollowedItemType,
  itemKey: string,
) {
  const { error } = await supabase
    .from("saved_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_key", itemKey)
    .eq("item_type", itemType);

  if (error) {
    throw error;
  }

  notifyUserLibraryChanged();
}
