"use client";

import { useEffect, useRef, useState } from "react";
import type { TicketmasterShow } from "../../lib/ticketmaster";
import {
  loadSavedTicketmasterEventIds,
  saveTicketmasterEvent,
  SAVED_EVENTS_CHANGED_EVENT,
  unsaveTicketmasterEvent,
} from "../../lib/saved-events";
import { ensureAnonymousUser } from "../../lib/saved-concerts";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";

export type ShowResult = TicketmasterShow;

export type UpcomingShowsRequest = {
  attractions?: { id: string; label: string }[];
  venues?: { id: string; label: string }[];
  postalCode?: string;
};

export function showsMessage(status: number, fallback: string) {
  if (status === 400) {
    return fallback || "Follow an artist or venue first.";
  }
  if (status === 429) {
    return "Ticketmaster is receiving too many requests right now. Try again shortly.";
  }
  if (status === 401) {
    return fallback || "Ticketmaster search is not set up correctly.";
  }
  if (status === 500 || status === 502) {
    return fallback || "There was a problem reaching Ticketmaster.";
  }
  return fallback || "There was a problem reaching Ticketmaster.";
}

export async function fetchUpcomingShows(
  body: UpcomingShowsRequest,
  signal?: AbortSignal,
) {
  const payload: UpcomingShowsRequest = {
    attractions: body.attractions ?? [],
    venues: body.venues ?? [],
  };
  const postalCode = body.postalCode?.trim();
  if (postalCode) {
    payload.postalCode = postalCode;
  }

  const response = await fetch("/api/ticketmaster/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as {
    shows?: ShowResult[];
    error?: string;
  };

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: showsMessage(response.status, data.error ?? ""),
    };
  }

  return { ok: true as const, shows: data.shows ?? [] };
}

export async function fetchEventDetails(ids: string[], signal?: AbortSignal) {
  const params = new URLSearchParams({ ids: ids.join(",") });
  const response = await fetch(`/api/ticketmaster/event-details?${params}`, {
    method: "GET",
    signal,
  });
  const data = (await response.json()) as {
    shows?: ShowResult[];
    error?: string;
  };

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      error: showsMessage(response.status, data.error ?? ""),
    };
  }

  return { ok: true as const, shows: data.shows ?? [] };
}

function placeLabel(show: ShowResult) {
  return [show.city, show.state].filter(Boolean).join(", ");
}

export function TicketmasterShowCard({
  show,
  saved = false,
  savePending = false,
  savesReady = true,
  onToggleSaved,
}: {
  show: ShowResult;
  saved?: boolean;
  savePending?: boolean;
  savesReady?: boolean;
  onToggleSaved?: () => void;
}) {
  const place = placeLabel(show);

  return (
    <li className="flex flex-col rounded-3xl border border-line bg-panel p-4 shadow-[0_12px_32px_rgba(0,0,0,0.32)] sm:p-5">
      {show.matchedLabels.length > 0 ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {show.matchedLabels.join(" \u00b7 ")}
        </p>
      ) : null}
      <h3 className="mt-2 font-display text-xl leading-tight tracking-tight">
        {show.matchedLabels[0] || show.name}
      </h3>
      {show.name && show.name !== show.matchedLabels[0] ? (
        <p className="mt-1 text-sm text-mute">{show.name}</p>
      ) : null}
      <p className="mt-2 text-sm text-accent">
        {show.dateLabel}
        {show.timeLabel ? ` \u00b7 ${show.timeLabel}` : ""}
      </p>
      {show.venueName ? (
        <p className="mt-1 text-sm text-foreground">{show.venueName}</p>
      ) : null}
      {place ? <p className="mt-0.5 text-sm text-mute">{place}</p> : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {onToggleSaved ? (
          <button
            type="button"
            aria-pressed={saved}
            aria-busy={savePending}
            disabled={!savesReady || savePending}
            onClick={onToggleSaved}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
          >
            {savePending ? "Saving\u2026" : saved ? "Saved" : "Save show"}
          </button>
        ) : null}
        {show.url ? (
          <a
            href={show.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${show.name} on Ticketmaster`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-line px-4 text-sm font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-fit"
          >
            View on Ticketmaster
          </a>
        ) : null}
      </div>
    </li>
  );
}

export function TicketmasterShowResults({
  pending,
  error,
  shows,
  heading,
  emptyMessage,
  emptyHint,
  onSearchWithoutZip,
  compact = false,
}: {
  pending: boolean;
  error: string | null;
  shows: ShowResult[] | null;
  heading?: string;
  emptyMessage: string;
  emptyHint?: string;
  onSearchWithoutZip?: () => void;
  compact?: boolean;
}) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savesReady, setSavesReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function readSavedIds() {
    const supabase = getSupabaseBrowserClient();
    await ensureAnonymousUser(supabase);
    return loadSavedTicketmasterEventIds(supabase);
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const next = await readSavedIds();
        if (cancelled) return;
        setSavedIds(next);
        setSavesReady(true);
        setSaveError(null);
      } catch {
        if (cancelled) return;
        setSaveError("Saved shows are temporarily unavailable.");
      }
    }

    void boot();

    function onSavedEventsChanged() {
      void readSavedIds()
        .then((next) => {
          if (cancelled) return;
          setSavedIds(next);
          setSavesReady(true);
          setSaveError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setSaveError("Could not refresh saved shows.");
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

  async function toggleSaved(show: ShowResult) {
    if (!savesReady || pendingIdsRef.current.has(show.id)) return;

    const wasSaved = savedIds.has(show.id);
    pendingIdsRef.current.add(show.id);
    setPendingIds(new Set(pendingIdsRef.current));
    setSaveError(null);
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(show.id);
      else next.add(show.id);
      return next;
    });

    try {
      const supabase = getSupabaseBrowserClient();
      const user = await ensureAnonymousUser(supabase);
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
      setSaveError(
        wasSaved
          ? "Could not remove that saved show. Try again."
          : "Could not save that show. Try again.",
      );
    } finally {
      pendingIdsRef.current.delete(show.id);
      setPendingIds(new Set(pendingIdsRef.current));
    }
  }

  if (error) {
    return (
      <p
        className="mt-5 max-w-xl rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (pending) {
    return (
      <p className="mt-5 text-sm text-mute" aria-live="polite">
        Loading shows...
      </p>
    );
  }

  if (!shows) {
    return null;
  }

  if (shows.length === 0) {
    return (
      <div className="mt-5 max-w-xl" aria-live="polite">
        <p className="text-sm leading-6 text-mute">{emptyMessage}</p>
        {emptyHint ? (
          <p className="mt-2 text-sm leading-6 text-mute">{emptyHint}</p>
        ) : null}
        {onSearchWithoutZip ? (
          <button
            type="button"
            onClick={onSearchWithoutZip}
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            Search without ZIP
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-6">
      {heading ? (
        <p
          className="mb-4 max-w-xl text-sm font-medium leading-6 text-foreground sm:text-base"
          aria-live="polite"
        >
          {heading}
        </p>
      ) : null}
      {saveError ? (
        <p className="mb-4 text-sm leading-6 text-mute" role="alert">
          {saveError}
        </p>
      ) : null}
      <ul
        className={
          compact
            ? "grid grid-cols-1 gap-3"
            : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {shows.map((show) => (
          <TicketmasterShowCard
            key={show.id}
            show={show}
            saved={savedIds.has(show.id)}
            savePending={pendingIds.has(show.id)}
            savesReady={savesReady}
            onToggleSaved={() => {
              void toggleSaved(show);
            }}
          />
        ))}
      </ul>
    </div>
  );
}
