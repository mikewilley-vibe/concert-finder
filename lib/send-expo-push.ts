import { chunkRows } from "./chunk-rows";
import { newShowPushCopy } from "./push-copy";
import type { FollowedItemType } from "./saved-follows";
import { getSupabaseAdminClient } from "./supabase/admin-client";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_CHUNK = 100;

type ExpoPushTicket = {
  status?: string;
  message?: string;
  details?: { error?: string };
};

export async function notifyUserOfNewShows(input: {
  userId: string;
  itemType: FollowedItemType;
  itemLabel: string;
  count: number;
}) {
  if (input.count < 1) {
    return { sent: 0 };
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("push_tokens")
    .select("expo_push_token")
    .eq("user_id", input.userId)
    .eq("enabled", true);

  if (error) {
    throw error;
  }

  const tokens = (data ?? [])
    .map((row) =>
      typeof row.expo_push_token === "string" ? row.expo_push_token.trim() : "",
    )
    .filter((token) => token.startsWith("ExponentPushToken"));

  if (tokens.length === 0) {
    return { sent: 0 };
  }

  const copy = newShowPushCopy({
    itemType: input.itemType,
    itemLabel: input.itemLabel,
    count: input.count,
  });
  const stale: string[] = [];
  let sent = 0;

  for (const group of chunkRows(tokens, EXPO_PUSH_CHUNK)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        group.map((to) => ({
          to,
          sound: "default",
          title: copy.title,
          body: copy.body,
          data: { screen: "home" },
        })),
      ),
    });

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as {
      data?: ExpoPushTicket[];
    };
    const tickets = payload.data ?? [];
    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        sent += 1;
        return;
      }
      if (ticket.details?.error === "DeviceNotRegistered") {
        const token = group[index];
        if (token) {
          stale.push(token);
        }
      }
    });
  }

  if (stale.length > 0) {
    await admin.from("push_tokens").delete().in("expo_push_token", stale);
  }

  return { sent };
}
