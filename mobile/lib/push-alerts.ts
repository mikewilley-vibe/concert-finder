import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  claimDevicePushToken,
  formatPushAlertError,
} from "./push-token-claim";

export type PushAlertResult =
  | { ok: true }
  | {
      ok: false;
      code: "expo_go" | "web" | "denied" | "unavailable";
      message: string;
    };

export type PushAlertFailure = Extract<PushAlertResult, { ok: false }>;

export {
  claimDevicePushToken,
  formatPushAlertError,
  isPermissionDeniedError,
} from "./push-token-claim";

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
        "Push alerts need a ShowSignal device build. Expo Go cannot receive these notifications.",
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
  _userId: string,
): Promise<PushAlertResult> {
  const blocked = remotePushBlockedReason();
  if (blocked) {
    return blocked;
  }

  let Notifications: typeof import("expo-notifications");
  try {
    Notifications = await import("expo-notifications");
  } catch (error) {
    return {
      ok: false,
      code: "unavailable",
      message: formatPushAlertError(
        error,
        "Notifications are not available in this build. Install a ShowSignal device build.",
      ),
    };
  }

  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "New show dates",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    } catch (error) {
      return {
        ok: false,
        code: "unavailable",
        message: formatPushAlertError(
          error,
          "Could not set up Android notification channel.",
        ),
      };
    }
  }

  let status: string;
  try {
    const existing = await Notifications.getPermissionsAsync();
    status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
  } catch (error) {
    return {
      ok: false,
      code: "denied",
      message: formatPushAlertError(
        error,
        "Could not check notification permission.",
      ),
    };
  }

  if (status !== "granted") {
    return {
      ok: false,
      code: "denied",
      message:
        "Notifications are off. Enable them for ShowSignal in Settings, then try again.",
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
        "This build is missing an Expo project id. Create a ShowSignal EAS build, then try again.",
    };
  }

  let expoPushToken = "";
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    expoPushToken = token.data?.trim() ?? "";
  } catch (error) {
    return {
      ok: false,
      code: "unavailable",
      message: formatPushAlertError(
        error,
        "Could not get an Expo push token for this device.",
      ),
    };
  }

  if (!expoPushToken.startsWith("ExponentPushToken")) {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not get a push token for this device. Try again.",
    };
  }

  try {
    await claimDevicePushToken(supabase, {
      expoPushToken,
      platform: Platform.OS === "ios" ? "ios" : "android",
    });
  } catch (error) {
    return {
      ok: false,
      code: "unavailable",
      message: formatPushAlertError(
        error,
        "Could not save this device's push token.",
      ),
    };
  }

  return { ok: true };
}
