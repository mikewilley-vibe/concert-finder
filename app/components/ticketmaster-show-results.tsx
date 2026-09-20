"use client";

import { useEffect, useRef, useState } from "react";
import {
  ConcertFinderApiError,
  createConcertFinderApiClient,
} from "../../shared/api/client";
import type {
  ConcertEvent,
  EventSearchRequest,
} from "../../shared/api/v1";
import {
  loadSavedTicketmasterEvents,
  saveTicketmasterEvent,
  SAVED_EVENTS_CHANGED_EVENT,
  unsaveTicketmasterEvent,
} from "../../lib/saved-events";
import { ensureAnonymousUser } from "../../lib/saved-concerts";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";

export type ShowResult = ConcertEvent;
export type UpcomingShowsRequest = EventSearchRequest;
export type WebAttendanceStatus = "interested" | "going";

const concertFinderApi = createConcertFinderApiClient();

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
  try {
    const data = await concertFinderApi.searchEvents(body, signal);
    return { ok: true as const, shows: data.events, page: data.page };
  } catch (error) {
    if (!(error instanceof ConcertFinderApiError)) {
      throw error;
    }
    return {
      ok: false as const,
      status: error.status,
      error: showsMessage(error.status, error.message),
    };
  }
}

export async function fetchEventDetails(ids: string[], signal?: AbortSignal) {
  try {
    const data = await concertFinderApi.eventDetails(ids, signal);
    return { ok: true as const, shows: data.events };
  } catch (error) {
    if (!(error instanceof ConcertFinderApiError)) {
      throw error;
    }
    return {
      ok: false as const,
      status: error.status,
      error: showsMessage(error.status, error.message),
    };
  }
}

function placeLabel(show: ShowResult) {
  return [show.venue.city, show.venue.stateCode ?? show.venue.state]
    .filter(Boolean)
    .join(", ");
}

export function TicketmasterShowCard({
  show,
  attendanceStatus = null,
  statusPending = false,
  statusesReady = true,
  onToggleStatus,
}: {
  show: ShowResult;
  attendanceStatus?: WebAttendanceStatus | null;
  statusPending?: boolean;
  statusesReady?: boolean;
  onToggleStatus?: (status: WebAttendanceStatus) => void;
}) {
  const place = placeLabel(show);
  const disrupted = ["canceled", "cancelled", "postponed", "rescheduled"].includes(
    show.status?.toLowerCase() ?? "",
  );
  const statusLabel = show.status
    ? show.status.charAt(0).toUpperCase() + show.status.slice(1).toLowerCase()
    : null;
  const sourceLabel = show.source?.label || "Ticketmaster";

  return (
    <li className="flex flex-col rounded-3xl border border-line bg-panel p-4 shadow-[0_12px_32px_rgba(0,0,0,0.32)] sm:p-5">
      {show.matchedLabels.length > 0 ? (
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {show.matchedLabels.join(" · ")}
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
        {show.timeLabel ? ` · ${show.timeLabel}` : ""}
      </p>
      {show.venue.name ? (
        <p className="mt-1 text-sm text-foreground">{show.venue.name}</p>
      ) : null}
      {place ? <p className="mt-0.5 text-sm text-mute">{place}</p> : null}
      {disrupted ? (
        <p
          role="alert"
          className="mt-3 rounded-2xl border border-red-400 bg-red-950/30 px-3 py-2 text-sm font-semibold text-red-300"
        >
          {statusLabel} — check the official listing before you go.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-mute">Source: {sourceLabel}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {onToggleStatus ? (
          <>
            <button
              type="button"
              aria-pressed={attendanceStatus === "interested"}
              aria-busy={statusPending}
              disabled={!statusesReady || statusPending}
              onClick={() => onToggleStatus("interested")}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-line px-4 text-sm font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
            >
              {attendanceStatus === "interested" ? "♡ Interested" : "Interested"}
            </button>
            <button
              type="button"
              aria-pressed={attendanceStatus === "going"}
              aria-busy={statusPending}
              disabled={!statusesReady || statusPending}
              onClick={() => onToggleStatus("going")}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-fit"
            >
              {statusPending
                ? "Updating…"
                : attendanceStatus === "going"
                  ? "✓ Locked"
                  : "Lock me in"}
            </button>
          </>
        ) : null}
        {show.ticketUrl ? (
          <a
            href={show.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View the official listing for ${show.name}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-line px-4 text-sm font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-fit"
          >
            {sourceLabel === "Ticketmaster"
              ? "View on Ticketmaster"
              : "View official listing"}
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
  const [savedStatuses, setSavedStatuses] = useState<
    Map<string, WebAttendanceStatus>
  >(new Map());
  const [savesReady, setSavesReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function readSavedStatuses() {
    const supabase = getSupabaseBrowserClient();
    await ensureAnonymousUser(supabase);
    const savedShows = await loadSavedTicketmasterEvents(supabase);
    return new Map(
      savedShows.map((show) => [show.id, show.attendanceStatus] as const),
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const next = await readSavedStatuses();
        if (cancelled) return;
        setSavedStatuses(next);
        setSavesReady(true);
        setSaveError(null);
      } catch {
        if (cancelled) return;
        setSaveError("Concert plans are temporarily unavailable.");
      }
    }

    void boot();

    function onSavedEventsChanged() {
      void readSavedStatuses()
        .then((next) => {
          if (cancelled) return;
          setSavedStatuses(next);
          setSavesReady(true);
          setSaveError(null);
        })
        .catch(() => {
          if (cancelled) return;
          setSaveError("Could not refresh concert plans.");
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

  async function toggleStatus(show: ShowResult, status: WebAttendanceStatus) {
    if (!savesReady || pendingIdsRef.current.has(show.id)) return;

    const previous = savedStatuses.get(show.id) ?? null;
    const nextStatus = previous === status ? null : status;
    pendingIdsRef.current.add(show.id);
    setPendingIds(new Set(pendingIdsRef.current));
    setSaveError(null);
    setSavedStatuses((current) => {
      const next = new Map(current);
      if (nextStatus) next.set(show.id, nextStatus);
      else next.delete(show.id);
      return next;
    });

    try {
      const supabase = getSupabaseBrowserClient();
      const user = await ensureAnonymousUser(supabase);
      if (!nextStatus) {
        await unsaveTicketmasterEvent(supabase, user.id, show.id);
      } else {
        await saveTicketmasterEvent(supabase, user.id, show, nextStatus);
      }
    } catch {
      setSavedStatuses((current) => {
        const next = new Map(current);
        if (previous) next.set(show.id, previous);
        else next.delete(show.id);
        return next;
      });
      setSaveError(
        nextStatus === "going"
          ? "Could not lock in that show. Try again."
          : nextStatus === "interested"
            ? "Could not mark that show Interested. Try again."
            : "Could not clear that show. Try again.",
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
            attendanceStatus={savedStatuses.get(show.id) ?? null}
            statusPending={pendingIds.has(show.id)}
            statusesReady={savesReady}
            onToggleStatus={(status) => {
              void toggleStatus(show, status);
            }}
          />
        ))}
      </ul>
    </div>
  );
}
