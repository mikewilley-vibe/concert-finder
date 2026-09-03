"use client";

import { useEffect, useState } from "react";
import {
  loadSavedTicketmasterEvents,
  SAVED_EVENTS_CHANGED_EVENT,
  unsaveTicketmasterEvent,
} from "../../lib/saved-events";
import { ensureAnonymousUser } from "../../lib/saved-concerts";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";
import {
  TicketmasterShowCard,
  type ShowResult,
} from "./ticketmaster-show-results";

export function SavedTicketmasterShows() {
  const [shows, setShows] = useState<ShowResult[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function readSavedShows() {
    const supabase = getSupabaseBrowserClient();
    await ensureAnonymousUser(supabase);
    return loadSavedTicketmasterEvents(supabase);
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const next = await readSavedShows();
        if (cancelled) return;
        setShows(next);
        setError(null);
      } catch {
        if (cancelled) return;
        setError("Could not load your saved Ticketmaster shows.");
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void boot();

    function onSavedEventsChanged() {
      void readSavedShows()
        .then((next) => {
          if (cancelled) return;
          setShows(next);
          setError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setError("Could not refresh your saved Ticketmaster shows.");
        });
    }

    window.addEventListener(SAVED_EVENTS_CHANGED_EVENT, onSavedEventsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(
        SAVED_EVENTS_CHANGED_EVENT,
        onSavedEventsChanged,
      );
    };
  }, []);

  async function remove(show: ShowResult) {
    if (pendingId) return;
    setPendingId(show.id);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const user = await ensureAnonymousUser(supabase);
      await unsaveTicketmasterEvent(supabase, user.id, show.id);
      setShows((current) => current.filter((item) => item.id !== show.id));
    } catch {
      setError("Could not remove that saved show. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  if (!ready || (!error && shows.length === 0)) {
    return null;
  }

  return (
    <section id="saved-ticketmaster-shows" className="scroll-mt-24">
      <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
        Saved Ticketmaster Shows
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
        Shows you saved from artist and venue results.
      </p>
      {error ? (
        <p
          className="mt-5 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {shows.length > 0 ? (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shows.map((show) => (
            <TicketmasterShowCard
              key={show.id}
              show={show}
              saved
              savePending={pendingId === show.id}
              onToggleSaved={() => {
                void remove(show);
              }}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
