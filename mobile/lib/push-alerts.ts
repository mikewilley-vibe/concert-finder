import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushAlertResult =
  | { ok: true }
  | {
      ok: false;
      code: "expo_go" | "web" | "denied" | "unavailable";
      message: string;
    };

export type PushAlertFailure = Extract<PushAlertResult, { ok: false }>;

export function isExpoGo() {
  return Constants.appOwnership === "expo";
}

export function openNotificationSettings() {
  void Linking.openSettings();
}

export function remotePushBlockedReason(): PushAlertFailure | null {
  if (Platform.OS === "web") {
    return {
      ok: false,
      code: "web",
      message: "Push alerts are for the iPhone and Android apps.",
    };
  }
  if (isExpoGo()) {
    return {
      ok: false,
      code: "expo_go",
      message:
        "Push alerts need a Local Shows device build. Expo Go cannot receive these notifications.",
    };
  }
  return null;
}

export async function hasEnabledPushToken(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("push_tokens")
    .select("id")
    .eq("user_id", userId)
    .eq("enabled", true)
    .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data?.length);
}

export async function disablePushAlerts(
  supabase: SupabaseClient,
  userId: string,
) {
  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function enablePushAlerts(
  supabase: SupabaseClient,
  userId: string,
): Promise<PushAlertResult> {
  const blocked = remotePushBlockedReason();
  if (blocked) {
    return blocked;
  }

  let Notifications: typeof import("expo-notifications");
  try {
    Notifications = await import("expo-notifications");
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message:
        "Notifications are not available in this build. Install a Local Shows device build.",
    };
  }

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "New show dates",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") {
      return {
        ok: false,
        code: "denied",
        message:
          "Notifications are off. Enable them for Local Shows in Settings, then try again.",
      };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      return {
        ok: false,
        code: "unavailable",
        message:
          "This build is missing an Expo project id. Create a Local Shows EAS build, then try again.",
      };
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    const expoPushToken = token.data?.trim() ?? "";
    if (!expoPushToken.startsWith("ExponentPushToken")) {
      return {
        ok: false,
        code: "unavailable",
        message: "Could not get a push token for this device. Try again.",
      };
    }

    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        platform: Platform.OS === "ios" ? "ios" : "android",
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "expo_push_token" },
    );

    if (error) {
      throw error;
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not turn on push alerts. Try again.",
    };
  }
}
