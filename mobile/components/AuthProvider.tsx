import * as Linking from "expo-linking";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { authErrorFields } from "@/lib/account";
import {
  authCallbackSuccessMessage,
  consumeAuthCallbackUrl,
  isAuthCallbackUrl,
} from "@/lib/auth-callback";
import {
  ensureAnonymousUser,
  isPermanentUser,
  mergeRememberedAnonymousData,
  rememberAnonymousSession,
} from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseClient } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  ready: boolean;
  configured: boolean;
  error: string | null;
  transferNotice: string | null;
  authLinkNotice: string | null;
  authLinkError: string | null;
  recoveryPending: boolean;
  clearRecoveryPending: () => void;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  ready: false,
  configured: false,
  error: null,
  transferNotice: null,
  authLinkNotice: null,
  authLinkError: null,
  recoveryPending: false,
  clearRecoveryPending: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [configState, setConfigState] = useState<
    "checking" | "configured" | "missing"
  >("checking");
  const configured = configState === "configured";
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const [authLinkNotice, setAuthLinkNotice] = useState<string | null>(null);
  const [authLinkError, setAuthLinkError] = useState<string | null>(null);
  const [recoveryPending, setRecoveryPending] = useState(false);

  const clearRecoveryPending = useCallback(() => {
    setRecoveryPending(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkConfiguration = () => {
      if (cancelled) {
        return;
      }
      if (isSupabaseConfigured()) {
        setConfigState("configured");
        return;
      }
      attempts += 1;
      if (attempts >= 20) {
        setConfigState("missing");
        setError(
          "Expo could not read the Supabase configuration after startup. Restart Expo from the mobile folder.",
        );
        setReady(true);
        return;
      }
      timer = setTimeout(checkConfiguration, 100);
    };

    checkConfiguration();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (configState === "checking") {
      return;
    }

    if (configState === "missing") {
      return;
    }

    const supabase = getSupabaseClient();
    let cancelled = false;

    async function applyAuthLink(url: string | null | undefined) {
      const result = await consumeAuthCallbackUrl(supabase, url);
      if (result.status === "ignored" || result.status === "empty") {
        return false;
      }

      if (result.status === "error") {
        if (!cancelled) {
          setAuthLinkError(result.message);
          setAuthLinkNotice(null);
        }
        return true;
      }

      if (!cancelled) {
        setUser(result.user);
        setSession(result.session);
        setError(null);
        setAuthLinkError(null);
        setAuthLinkNotice(authCallbackSuccessMessage(result.type));
        setRecoveryPending(result.type === "recovery");
        if (isPermanentUser(result.user) && result.session) {
          try {
            const merged = await mergeRememberedAnonymousData(
              result.session,
              result.user,
            );
            if (!cancelled && merged) {
              setTransferNotice(
                "Your guest follows and saved shows were moved to this account.",
              );
            }
          } catch {
            if (!cancelled) {
              setTransferNotice(
                "You are signed in, but guest data could not be moved yet. Sign out and back in to retry.",
              );
            }
          }
        }
      }
      return true;
    }

    void (async () => {
      try {
        const incoming =
          Linking.getLinkingURL() ?? (await Linking.getInitialURL());
        await applyAuthLink(incoming);
        if (cancelled) {
          return;
        }

        const { data: afterLink } = await supabase.auth.getSession();
        if (afterLink.session?.user && isPermanentUser(afterLink.session.user)) {
          setUser(afterLink.session.user);
          setSession(afterLink.session);
          setError(null);
          setReady(true);
          return;
        }

        const next = await ensureAnonymousUser(supabase);
        const { data } = await supabase.auth.getSession();
        if (cancelled) {
          return;
        }

        setUser(next);
        setSession(data.session);
        setError(null);
        await rememberAnonymousSession(data.session);

        if (isPermanentUser(next)) {
          try {
            const merged = await mergeRememberedAnonymousData(
              data.session,
              next,
            );
            if (!cancelled && merged) {
              setTransferNotice(
                "Your guest follows and saved shows were moved to this account.",
              );
            }
          } catch {
            if (!cancelled) {
              setTransferNotice(
                "You are signed in, but guest data could not be moved yet. Sign out and back in to retry.",
              );
            }
          }
        }
      } catch (authError) {
        if (!cancelled) {
          const { message, code } = authErrorFields(authError);
          const detail = message || code;
          setError(
            detail
              ? `Couldn't start a guest session: ${detail}`
              : "Couldn't start a guest session. Check the public Supabase values in mobile/.env.",
          );
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "INITIAL_SESSION") {
        return;
      }

      setUser(nextSession?.user ?? null);
      setSession(nextSession);
      if (nextSession?.user?.is_anonymous) {
        void rememberAnonymousSession(nextSession);
      }
    });

    const linking = Linking.addEventListener("url", ({ url }) => {
      if (!isAuthCallbackUrl(url)) {
        return;
      }
      void applyAuthLink(url);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      linking.remove();
    };
  }, [configState]);

  const value = useMemo(
    () => ({
      user,
      session,
      ready,
      configured,
      error,
      transferNotice,
      authLinkNotice,
      authLinkError,
      recoveryPending,
      clearRecoveryPending,
    }),
    [
      user,
      session,
      ready,
      configured,
      error,
      transferNotice,
      authLinkNotice,
      authLinkError,
      recoveryPending,
      clearRecoveryPending,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
