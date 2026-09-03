import type { AuthError, EmailOtpType, User } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "./supabase/database.types";

export const PASSWORD_SET_KEY = "password_set";
export const MIN_PASSWORD_LENGTH = 8;

export function accountRedirectUrl() {
  return `${window.location.origin}/account`;
}

export function isPermanentUser(user: User | null) {
  return Boolean(user && user.is_anonymous === false);
}

export function isAnonymousUser(user: User | null) {
  return Boolean(user?.is_anonymous);
}

export function pendingEmail(user: User | null) {
  const next = user?.new_email?.trim();
  return next || null;
}

export function verifiedEmail(user: User | null) {
  if (!user?.email || !user.email_confirmed_at || user.is_anonymous) {
    return null;
  }

  return user.email;
}

export function hasPasswordSet(user: User | null) {
  return user?.user_metadata?.[PASSWORD_SET_KEY] === true;
}

export function authErrorFields(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as AuthError).code)
      : "";
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as AuthError).status)
      : 0;

  return { message, code, status };
}

export function upgradeEmailMessage(error: unknown) {
  const { message, code } = authErrorFields(error);

  if (message.includes("NEXT_PUBLIC_SUPABASE")) {
    return "Couldn't start a session. Try refreshing the page.";
  }

  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    /already been registered|already registered|already exists/i.test(message)
  ) {
    return "That email already belongs to an account. Signing into an existing account is different from upgrading this anonymous session, because the two accounts may have different saved data.";
  }

  if (code === "anonymous_provider_disabled") {
    return "Couldn't start a session. Try refreshing the page.";
  }

  if (/invalid.*email|email.*invalid|valid email/i.test(message)) {
    return "That email address does not look valid. Check the spelling and try again.";
  }

  if (/rate limit|over_request|too many/i.test(message)) {
    return "Too many emails were requested. Wait a bit, then try again.";
  }

  return "Could not send the verification email. Check the address and try again.";
}

export function passwordMessage(error: unknown) {
  const { message, code } = authErrorFields(error);

  if (
    code === "weak_password" ||
    (/password/i.test(message) && /weak|short|character|least/i.test(message))
  ) {
    return `Choose a stronger password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (/reauthentication|nonce|recently signed in/i.test(message)) {
    return "Sign out, verify your email, sign back in, then try again.";
  }

  return "Could not save that password. Try a different one, at least 8 characters.";
}

export function signInMessage(error: unknown) {
  const { message, code, status } = authErrorFields(error);

  if (
    code === "invalid_credentials" ||
    status === 400 ||
    /invalid login|invalid credentials|wrong password/i.test(message)
  ) {
    return "That email or password did not match. Check both and try again.";
  }

  if (/email not confirmed|not confirmed/i.test(message)) {
    return "That email still needs to be verified. Open the latest message and use the confirmation link.";
  }

  return "Could not sign in right now. Try again.";
}

export function confirmationMessage(detail: string) {
  if (/otp_expired|expired|invalid/i.test(detail)) {
    return "That confirmation link is expired or invalid. Request a new verification email.";
  }

  if (/access_denied/i.test(detail)) {
    return "The confirmation link was denied. Request a new verification email.";
  }

  return "Could not finish email confirmation. Request a new verification email.";
}

export async function consumeAuthRedirect(supabase: AppSupabaseClient) {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const rawError =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error") ||
    hash.get("error_description") ||
    hash.get("error");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const shouldClean =
    Boolean(rawError) ||
    Boolean(tokenHash) ||
    url.searchParams.has("code") ||
    hash.has("access_token") ||
    hash.has("error");

  let notice: string | null = null;

  if (rawError) {
    notice = confirmationMessage(rawError);
  } else if (tokenHash) {
    const otpType: EmailOtpType =
      type === "signup" || type === "email" || type === "invite"
        ? type
        : "email_change";
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });

    if (error) {
      notice = confirmationMessage(error.message);
    }
  }

  if (shouldClean) {
    window.history.replaceState({}, "", url.pathname);
  }

  return notice;
}

export async function markPasswordSet(supabase: AppSupabaseClient) {
  const { error } = await supabase.auth.updateUser({
    data: { [PASSWORD_SET_KEY]: true },
  });

  if (error) {
    throw error;
  }
}
