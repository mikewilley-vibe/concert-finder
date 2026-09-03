import type { User } from "@supabase/supabase-js";
import type { ListingItem } from "./listing-item";
import type { AppSupabaseClient } from "./supabase/database.types";

export const SAVED_CONCERT_TYPE = "concert";

export function concertItemKey(item: ListingItem) {
  return item.id;
}

export function concertItemLabel(item: ListingItem) {
  return `${item.title} · ${item.place}`;
}

let pendingAnonymousSignIn: Promise<User> | null = null;

export async function ensureAnonymousUser(
  supabase: AppSupabaseClient,
): Promise<User> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (session?.user) {
    return session.user;
  }

  if (!pendingAnonymousSignIn) {
    pendingAnonymousSignIn = (async () => {
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Anonymous sign-in did not return a user.");
      }

      return data.user;
    })().finally(() => {
      pendingAnonymousSignIn = null;
    });
  }

  return pendingAnonymousSignIn;
}

export async function loadSavedConcertKeys(supabase: AppSupabaseClient) {
  const { data, error } = await supabase
    .from("saved_items")
    .select("item_key")
    .eq("item_type", SAVED_CONCERT_TYPE);

  if (error) {
    throw error;
  }

  return new Set(
    (data ?? [])
      .map((row) => row.item_key)
      .filter((key): key is string => typeof key === "string"),
  );
}

export async function saveConcert(
  supabase: AppSupabaseClient,
  userId: string,
  item: ListingItem,
) {
  const { error } = await supabase.from("saved_items").insert({
    user_id: userId,
    item_key: concertItemKey(item),
    item_label: concertItemLabel(item),
    item_type: SAVED_CONCERT_TYPE,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

export async function unsaveConcert(
  supabase: AppSupabaseClient,
  userId: string,
  item: ListingItem,
) {
  const { error } = await supabase
    .from("saved_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_key", concertItemKey(item))
    .eq("item_type", SAVED_CONCERT_TYPE);

  if (error) {
    throw error;
  }
}
