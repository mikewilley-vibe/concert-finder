import type { AppSupabaseClient } from "./supabase/database.types";

export const FOLLOWED_ATTRACTION_TYPE = "ticketmaster_attraction";
export const FOLLOWED_VENUE_TYPE = "ticketmaster_venue";
export const MAX_MONITORED_FOLLOWS = 8;
export const FOLLOWS_CHANGED_EVENT = "my-shows:follows-changed";

export function notifyFollowsChanged() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(FOLLOWS_CHANGED_EVENT));
}

export type FollowedItemType =
  | typeof FOLLOWED_ATTRACTION_TYPE
  | typeof FOLLOWED_VENUE_TYPE;

export type FollowedItem = {
  item_key: string;
  item_label: string;
};

export async function loadFollowedItems(
  supabase: AppSupabaseClient,
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
    .map((row) => {
      const item_key =
        typeof row.item_key === "string" ? row.item_key.trim() : "";
      const item_label =
        typeof row.item_label === "string" ? row.item_label.trim() : "";
      if (!item_key || !item_label) {
        return null;
      }
      return { item_key, item_label };
    })
    .filter((row): row is FollowedItem => Boolean(row));
}

export async function followItem(
  supabase: AppSupabaseClient,
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
}

export async function unfollowItem(
  supabase: AppSupabaseClient,
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
}
