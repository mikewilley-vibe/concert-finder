import type { AppSupabaseClient } from "./supabase/database.types";

export async function dismissSuggestion(
  supabase: AppSupabaseClient,
  userId: string,
  itemType: "ticketmaster_attraction" | "ticketmaster_venue",
  item: { id: string; name: string },
) {
  const { error } = await supabase.from("suggestion_dismissals").insert({
    user_id: userId,
    item_type: itemType,
    item_key: item.id,
    item_label: item.name,
  });
  if (error && error.code !== "23505") {
    return false;
  }
  return true;
}
