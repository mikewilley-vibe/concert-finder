import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import type { TicketmasterShow } from "@/lib/api";
import {
  loadSavedTicketmasterEventIds,
  loadSavedTicketmasterEvents,
  saveTicketmasterEvent,
  unsaveTicketmasterEvent,
} from "@/lib/saved-events";
import { getSupabaseClient } from "@/lib/supabase";
import { subscribeUserLibrary } from "@/lib/sync";

export function useSavedEvents() {
  const { user, ready: authReady, configured } = useAuth();
  const [shows, setShows] = useState<TicketmasterShow[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const pendingIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!configured) {
      setShows([]);
      setSavedIds(new Set());
      setReady(true);
      return;
    }

    const supabase = getSupabaseClient();
    const [nextShows, nextIds] = await Promise.all([
      loadSavedTicketmasterEvents(supabase),
      loadSavedTicketmasterEventIds(supabase),
    ]);
    setShows(nextShows);
    setSavedIds(nextIds);
    setError(null);
    setReady(true);
  }, [configured]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      void refresh().catch(() => {
        if (!cancelled) {
          setError("Could not load saved shows.");
          setReady(true);
        }
      });
    }, 0);

    const unsubscribe = subscribeUserLibrary(() => {
      void refresh().catch(() => {
        if (!cancelled) {
          setError("Could not refresh saved shows.");
        }
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [authReady, refresh, user?.id]);

  async function toggleSaved(show: TicketmasterShow) {
    if (!configured || !ready || pendingIdsRef.current.has(show.id)) {
      return;
    }

    if (!user?.id) {
      setError("Couldn't start a session. Try reopening the app.");
      return;
    }

    const wasSaved = savedIds.has(show.id);
    pendingIdsRef.current.add(show.id);
    setPendingIds(new Set(pendingIdsRef.current));
    setError(null);
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(show.id);
      else next.add(show.id);
      return next;
    });
    setShows((current) => {
      if (wasSaved) {
        return current.filter((item) => item.id !== show.id);
      }
      if (current.some((item) => item.id === show.id)) {
        return current;
      }
      return [show, ...current];
    });

    try {
      const supabase = getSupabaseClient();
      if (wasSaved) {
        await unsaveTicketmasterEvent(supabase, user.id, show.id);
      } else {
        await saveTicketmasterEvent(supabase, user.id, show);
      }
    } catch {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(show.id);
        else next.delete(show.id);
        return next;
      });
      setShows((current) => {
        if (wasSaved) {
          if (current.some((item) => item.id === show.id)) {
            return current;
          }
          return [show, ...current];
        }
        return current.filter((item) => item.id !== show.id);
      });
      setError(
        wasSaved
          ? "Could not remove that saved show. Try again."
          : "Could not save that show. Try again.",
      );
    } finally {
      pendingIdsRef.current.delete(show.id);
      setPendingIds(new Set(pendingIdsRef.current));
    }
  }

  return {
    shows,
    savedIds,
    ready,
    error,
    configured,
    toggleSaved,
    isPending: (id: string) => pendingIds.has(id),
    refresh,
  };
}
