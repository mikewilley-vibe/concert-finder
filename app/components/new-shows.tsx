"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isPermanentUser } from "../../lib/account";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";
import {
  latestCheckedAt,
  loadOwnWatchState,
  markOwnWatchStateSeen,
  uniqueNewEventIds,
  type WatchStateRow,
} from "../../lib/watch-state";
import {
  fetchEventDetails,
  TicketmasterShowCard,
  type ShowResult,
} from "./ticketmaster-show-results";

const headingClass = "font-display text-2xl tracking-tight sm:text-3xl";
const bodyClass = "mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base";
const primaryButtonClass =
  "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto";

function formatCheckedAt(value: string | null) {
  if (!value) {
    return "Not checked yet";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not checked yet";
  }
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function NewShows() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<WatchStateRow[]>([]);
  const [shows, setShows] = useState<ShowResult[]>([]);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user: nextUser },
    } = await supabase.auth.getUser();
    setUser(nextUser);

    if (!isPermanentUser(nextUser)) {
      setRows([]);
      setShows([]);
      setReady(true);
      return;
    }

    const nextRows = await loadOwnWatchState(supabase);
    setRows(nextRows);
    const ids = uniqueNewEventIds(nextRows).slice(0, 8);
    if (ids.length === 0) {
      setShows([]);
      setReady(true);
      return;
    }

    const details = await fetchEventDetails(ids);
    if (!details.ok) {
      setError(details.error);
      setShows([]);
      setReady(true);
      return;
    }
    setShows(details.shows);
    setReady(true);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) {
          setError("Could not load new shows.");
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function markAllSeen() {
    setPending(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const toClear = rows.filter((row) => row.new_event_ids.length > 0);
      for (const row of toClear) {
        await markOwnWatchStateSeen(supabase, row.id);
      }
      await refresh();
    } catch {
      setError("Could not mark those shows as seen.");
    } finally {
      setPending(false);
    }
  }

  const newCount = uniqueNewEventIds(rows).length;
  const lastChecked = formatCheckedAt(latestCheckedAt(rows));

  if (!ready) {
    return (
      <section id="new-shows" className="scroll-mt-24">
        <h2 className={headingClass}>New Shows Found</h2>
        <p className={bodyClass}>Checking your latest scheduled results…</p>
      </section>
    );
  }

  if (!isPermanentUser(user)) {
    return (
      <section id="new-shows" className="scroll-mt-24">
        <h2 className={headingClass}>Save your account first</h2>
        <p className={bodyClass}>
          An automation needs a lasting account so it knows whose preferences it
          is checking.
        </p>
        <Link
          href="/account"
          className={`${primaryButtonClass} mt-5 sm:w-auto`}
        >
          Go to account
        </Link>
      </section>
    );
  }

  return (
    <section id="new-shows" className="scroll-mt-24">
      {newCount > 0 ? (
        <>
          <h2 className={headingClass}>New Shows Found</h2>
          <p className={bodyClass}>
            These Ticketmaster event IDs showed up after your last scheduled
            check.
          </p>
        </>
      ) : (
        <>
          <h2 className={headingClass}>Your starting point is set</h2>
          <p className={bodyClass}>
            Your automation now knows what Ticketmaster already had. On future
            checks, it can recognize something that wasn&apos;t there before.
          </p>
          <p className="mt-3 text-sm text-foreground sm:text-base">
            No new shows since the last check.
          </p>
        </>
      )}

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-panel px-4 py-3">
          <dt className="text-mute">Last checked</dt>
          <dd className="mt-1 font-medium">{lastChecked}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-panel px-4 py-3">
          <dt className="text-mute">New shows</dt>
          <dd className="mt-1 font-medium">{newCount}</dd>
        </div>
      </dl>

      {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}

      {shows.length > 0 ? (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {shows.map((show) => (
            <TicketmasterShowCard key={show.id} show={show} />
          ))}
        </ul>
      ) : null}

      {newCount > 0 ? (
        <button
          type="button"
          onClick={() => void markAllSeen()}
          disabled={pending}
          className={`${primaryButtonClass} mt-6`}
        >
          {pending ? "Saving…" : "Mark as seen"}
        </button>
      ) : null}
    </section>
  );
}
