import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";

import { ensureAnonymousUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";
import { getSupabaseClient } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  ready: boolean;
  configured: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  ready: false,
  configured: false,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = getSupabaseClient();
    let cancelled = false;

    void (async () => {
      try {
        const next = await ensureAnonymousUser(supabase);
        if (!cancelled) {
          setUser(next);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Couldn't start a guest session. Check the public Supabase values in mobile/.env.",
          );
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [configured]);

  const value = useMemo(
    () => ({ user, ready, configured, error }),
    [user, ready, configured, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
