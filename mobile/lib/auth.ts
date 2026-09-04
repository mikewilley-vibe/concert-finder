import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { PASSWORD_SET_KEY } from "./account";
import { mergeAnonymousAccount } from "./api";
import { websiteUrl } from "./config";

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

export type SignInResult = {
  user: User;
  merged: boolean;
  mergeFailed: boolean;
};

export async function signInWithEmailPassword(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<SignInResult> {
  const previous = await supabase.auth.getSession();
  await rememberAnonymousSession(previous.data.session);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Sign-in did not return a user.");
  }

  let merged = false;
  let mergeFailed = false;
  try {
    merged = await mergeRememberedAnonymousData(data.session, data.user);
  } catch {
    mergeFailed = true;
  }

  return { user: data.user, merged, mergeFailed };
}

export async function createAccountFromGuest(
  supabase: SupabaseClient,
  email: string,
  password: string,
) {
  const { error } = await supabase.auth.updateUser(
    {
      email,
      password,
      data: { [PASSWORD_SET_KEY]: true },
    },
    { emailRedirectTo: websiteUrl("/account") },
  );

  if (error) {
    throw error;
  }

  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function setAccountPassword(
  supabase: SupabaseClient,
  password: string,
) {
  const { error } = await supabase.auth.updateUser({
    password,
    data: { [PASSWORD_SET_KEY]: true },
  });

  if (error) {
    throw error;
  }

  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function requestPasswordReset(
  supabase: SupabaseClient,
  email: string,
) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: websiteUrl("/account"),
  });

  if (error) {
    throw error;
  }
}

export async function signOutToGuest(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }

  return ensureAnonymousUser(supabase);
}
