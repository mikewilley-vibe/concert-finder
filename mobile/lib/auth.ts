import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { mergeAnonymousAccount } from "./api";

const PENDING_ANONYMOUS_TOKEN_KEY = "local-shows:pending-anonymous-token";

let pendingAnonymousSignIn: Promise<User> | null = null;

export async function ensureAnonymousUser(
  supabase: SupabaseClient,
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

export async function rememberAnonymousSession(session: Session | null) {
  if (!session?.user.is_anonymous || !session.access_token) {
    return;
  }

  await AsyncStorage.setItem(PENDING_ANONYMOUS_TOKEN_KEY, session.access_token);
}

export async function mergeRememberedAnonymousData(
  session: Session | null,
  user: User | null,
) {
  if (!session?.access_token || !user || user.is_anonymous !== false) {
    return false;
  }

  const previousAccessToken = await AsyncStorage.getItem(
    PENDING_ANONYMOUS_TOKEN_KEY,
  );
  if (!previousAccessToken || previousAccessToken === session.access_token) {
    return false;
  }

  await mergeAnonymousAccount({
    currentAccessToken: session.access_token,
    previousAccessToken,
  });
  await AsyncStorage.removeItem(PENDING_ANONYMOUS_TOKEN_KEY);
  return true;
}

export function isAnonymousUser(user: User | null) {
  return Boolean(user?.is_anonymous);
}

export function isPermanentUser(user: User | null) {
  return Boolean(user && user.is_anonymous === false);
}
