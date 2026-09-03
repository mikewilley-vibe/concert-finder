import type { Session, User } from "@supabase/supabase-js";

const PENDING_ANONYMOUS_TOKEN_KEY = "my-shows:pending-anonymous-token";

export function rememberAnonymousSession(session: Session | null) {
  if (!session?.user.is_anonymous || !session.access_token) {
    return;
  }

  window.sessionStorage.setItem(
    PENDING_ANONYMOUS_TOKEN_KEY,
    session.access_token,
  );
}

export async function mergeRememberedAnonymousData(
  session: Session | null,
  user: User | null,
) {
  if (!session?.access_token || !user || user.is_anonymous !== false) {
    return false;
  }

  const previousAccessToken = window.sessionStorage.getItem(
    PENDING_ANONYMOUS_TOKEN_KEY,
  );
  if (!previousAccessToken || previousAccessToken === session.access_token) {
    return false;
  }

  const response = await fetch("/api/account/merge-anonymous", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ previousAccessToken }),
  });

  if (!response.ok) {
    throw new Error("Could not transfer the temporary account data.");
  }

  window.sessionStorage.removeItem(PENDING_ANONYMOUS_TOKEN_KEY);
  return true;
}
