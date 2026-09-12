import type { SupabaseClient } from "@supabase/supabase-js";

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

function textField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function isPermissionDeniedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const value = error as ErrorLike;
  const code = textField(value.code);
  const blob = [code, textField(value.message), textField(value.details)]
    .filter(Boolean)
    .join(" ");
  return (
    code === "42501" ||
    /permission denied|row-level security|not authenticated/i.test(blob)
  );
}

export function formatPushAlertError(error: unknown, fallback: string) {
  if (error == null) {
    return fallback;
  }

  if (typeof error === "object") {
    const value = error as ErrorLike;
    const code = textField(value.code);
    const message = textField(value.message);
    const details = textField(value.details);
    const hint = textField(value.hint);
    const parts = [code, message, details, hint].filter(Boolean);

    if (parts.length === 0) {
      return fallback;
    }

    if (isPermissionDeniedError(error)) {
      return `${fallback} Permission denied (${parts.join(" — ")}).`;
    }

    return `${fallback} (${parts.join(" — ")})`;
  }

  if (typeof error === "string" && error.trim()) {
    return `${fallback} (${error.trim()})`;
  }

  return fallback;
}

export async function claimDevicePushToken(
  supabase: SupabaseClient,
  input: { expoPushToken: string; platform: "ios" | "android" },
) {
  const { error } = await supabase.rpc("claim_device_push_token", {
    p_expo_push_token: input.expoPushToken,
    p_platform: input.platform,
  });

  if (error) {
    throw error;
  }
}
