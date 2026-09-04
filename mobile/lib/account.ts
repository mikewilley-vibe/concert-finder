import type { AuthError, User } from "@supabase/supabase-js";

export const PASSWORD_SET_KEY = "password_set";
export const MIN_PASSWORD_LENGTH = 8;

export function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  if (
    message.includes("EXPO_PUBLIC_SUPABASE") ||
    message.includes("NEXT_PUBLIC_SUPABASE")
  ) {
    return "Couldn't start a session. Check the public Supabase values and try again.";
  }

  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    /already been registered|already registered|already exists/i.test(message)
  ) {
    return "That email already belongs to an account. Sign in instead — guest follows and saves can move with you.";
  }

  if (code === "anonymous_provider_disabled") {
    return "Couldn't start a session. Check the public Supabase values and try again.";
  }

  if (/invalid.*email|email.*invalid|valid email/i.test(message)) {
    return "That email address does not look valid. Check the spelling and try again.";
  }

  if (/rate limit|over_request|too many/i.test(message)) {
    return "Too many emails were requested. Wait a bit, then try again.";
  }

  return "Could not create that account. Check the address and try again.";
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

export function recoveryMessage(error: unknown) {
  const { message, code } = authErrorFields(error);

  if (/rate limit|over_request|too many/i.test(message) || code === "over_email_send_rate_limit") {
    return "Too many reset emails were requested. Wait a bit, then try again.";
  }

  if (/invalid.*email|email.*invalid|valid email/i.test(message)) {
    return "That email address does not look valid. Check the spelling and try again.";
  }

  return "Could not send a reset email right now. Try again.";
}

export function followsMessage(error: unknown) {
  const { message, code } = authErrorFields(error);

  if (
    message.includes("EXPO_PUBLIC_SUPABASE") ||
    message.includes("NEXT_PUBLIC_SUPABASE")
  ) {
    return "Couldn't save that. Check the public Supabase values and try again.";
  }

  if (
    code === "anonymous_provider_disabled" ||
    /anonymous sign-ins are disabled/i.test(message)
  ) {
    return "Couldn't start a session. Try reopening the app.";
  }

  return "Could not update who you follow. Try again.";
}
