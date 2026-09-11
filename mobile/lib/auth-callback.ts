import type { EmailOtpType, Session, SupabaseClient, User } from "@supabase/supabase-js";

import {
  authCallbackErrorMessage,
  authCallbackSuccessMessage,
  hasAuthPayload,
  isAuthCallbackUrl,
  parseAuthCallback,
  type AuthCallbackPayload,
} from "../../shared/auth-callback";
import { rememberAnonymousSession, mergeRememberedAnonymousData } from "./auth";

export {
  authCallbackErrorMessage,
  authCallbackSuccessMessage,
  hasAuthPayload,
  isAuthCallbackUrl,
  parseAuthCallback,
};

const handledUrls = new Set<string>();

function otpTypeFrom(type: string | null): EmailOtpType {
  if (
    type === "signup" ||
    type === "invite" ||
    type === "magiclink" ||
    type === "recovery" ||
    type === "email_change" ||
    type === "email"
  ) {
    return type;
  }

  return "email";
}

function payloadError(payload: AuthCallbackPayload) {
  return payload.errorDescription || payload.error;
}

export type AuthCallbackConsumeResult =
  | { status: "ignored" }
  | { status: "empty" }
  | { status: "error"; message: string }
  | { status: "ok"; type: string | null; user: User; session: Session | null };

export async function consumeAuthCallbackUrl(
  supabase: SupabaseClient,
  url: string | null | undefined,
): Promise<AuthCallbackConsumeResult> {
  if (!url || !isAuthCallbackUrl(url)) {
    return { status: "ignored" };
  }

  if (handledUrls.has(url)) {
    return { status: "ignored" };
  }
  handledUrls.add(url);

  const payload = parseAuthCallback(url);
  const linkError = payloadError(payload);
  if (linkError) {
    return {
      status: "error",
      message: authCallbackErrorMessage(linkError),
    };
  }

  if (!hasAuthPayload(payload)) {
    return { status: "empty" };
  }

  const previous = await supabase.auth.getSession();
  await rememberAnonymousSession(previous.data.session);

  try {
    if (payload.accessToken && payload.refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
      });
      if (error) {
        throw error;
      }
      return await finishAuthCallback(supabase, data.user, data.session, payload.type);
    }

    if (payload.tokenHash) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: payload.tokenHash,
        type: otpTypeFrom(payload.type),
      });
      if (error) {
        throw error;
      }
      return await finishAuthCallback(supabase, data.user, data.session, payload.type);
    }

    if (payload.code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        payload.code,
      );
      if (error) {
        throw error;
      }
      return await finishAuthCallback(supabase, data.user, data.session, payload.type);
    }

    return { status: "empty" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not finish email confirmation.";
    return {
      status: "error",
      message: authCallbackErrorMessage(message),
    };
  }
}

async function finishAuthCallback(
  supabase: SupabaseClient,
  user: User | null,
  session: Session | null,
  type: string | null,
): Promise<AuthCallbackConsumeResult> {
  const nextUser = user ?? (await supabase.auth.getUser()).data.user;
  if (!nextUser) {
    return {
      status: "error",
      message: authCallbackErrorMessage("invalid"),
    };
  }

  try {
    await mergeRememberedAnonymousData(session, nextUser);
  } catch {
    // Profile already explains a failed guest transfer if needed.
  }

  return {
    status: "ok",
    type,
    user: nextUser,
    session,
  };
}
