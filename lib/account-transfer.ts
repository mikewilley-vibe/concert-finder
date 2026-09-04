import type { Session, User } from "@supabase/supabase-js";
import { createConcertFinderApiClient } from "../shared/api/client";

const PENDING_ANONYMOUS_TOKEN_KEY = "my-shows:pending-anonymous-token";
const concertFinderApi = createConcertFinderApiClient();

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

  await concertFinderApi.mergeAnonymousAccount(
    session.access_token,
    previousAccessToken,
  );

  window.sessionStorage.removeItem(PENDING_ANONYMOUS_TOKEN_KEY);
  return true;
}
