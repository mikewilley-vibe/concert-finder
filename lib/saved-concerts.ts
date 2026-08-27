import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { SampleItem } from "../data/sample-items";

export const SAVED_CONCERT_TYPE = "concert";

export function concertItemKey(item: SampleItem) {
  return item.id;
}

export function concertItemLabel(item: SampleItem) {
  return `${item.title} · ${item.place}`;
}

let pendingAnonymousUser: Promise<User> | null = null;

export async function ensureAnonymousUser(
  supabase: SupabaseClient,
): Promise<User> {
  if (!pendingAnonymousUser) {
    pendingAnonymousUser = (async () => {
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

      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Anonymous sign-in did not return a user.");
      }

      return data.user;
    })();
  }

  try {
    return await pendingAnonymousUser;
  } catch (error) {
    pendingAnonymousUser = null;
    throw error;
  }
}

export async function loadSavedConcertKeys(supabase: SupabaseClient) {
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
  supabase: SupabaseClient,
  userId: string,
  item: SampleItem,
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
  supabase: SupabaseClient,
  userId: string,
  item: SampleItem,
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
