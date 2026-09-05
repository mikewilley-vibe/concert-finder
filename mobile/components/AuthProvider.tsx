import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";

import { authErrorFields } from "@/lib/account";
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
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  ready: false,
  configured: false,
  error: null,
  transferNotice: null,
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

    void (async () => {
      try {
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

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
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
    }),
    [user, session, ready, configured, error, transferNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
