import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { authErrorFields } from "@/lib/account";
import type { TicketmasterShow } from "@/lib/api";
import {
  applyAttendanceStatus,
  calendarLinkFor,
  nextExclusiveStatus,
  shouldWriteCalendarEvent,
  showsWithStatus,
  statusFor,
  type AttendanceState,
  type AttendanceStatus,
  type CalendarLink,
} from "@/lib/attendance";
import {
  ensureAttendanceLoaded,
  getAttendanceState,
  isAttendanceReady,
  mergeRemoteAttendance,
  subscribeAttendance,
  writeAttendanceStatus,
  writeCalendarLink,
} from "@/lib/attendance-store";
import { addShowToCalendar, type AddToCalendarResult } from "@/lib/calendar";
import { buildCalendarEvent } from "@/lib/calendar-event";
import { promptAddToCalendar } from "@/lib/calendar-offer";
import { websiteUrl } from "@/lib/config";
import { recordInteraction } from "@/lib/interaction-signals-store";
import {
  loadAttendanceState,
  saveTicketmasterEvent,
  unsaveTicketmasterEvent,
  updateSavedEventCalendar,
} from "@/lib/saved-events";
import { getSupabaseClient } from "@/lib/supabase";
import { subscribeUserLibrary } from "@/lib/sync";

export type SetAttendanceResult =
  | {
      ok: true;
      status: AttendanceStatus | null;
      offerCalendar: boolean;
    }
  | { ok: false };

function websiteOrigin() {
  return websiteUrl("/").replace(/\/$/, "");
}

export function savedShowsLoadMessage(error: unknown) {
  const { message, code, status } = authErrorFields(error);

  if (
    /Failed to fetch|Network request failed|Load failed|The Internet connection appears to be offline/i.test(
      message,
    )
  ) {
    return "Network error. Your Locked and Interested shows on this phone are still here.";
  }

  if (
    status === 401 ||
    code === "PGRST301" ||
    /jwt expired|invalid jwt|not authenticated/i.test(message)
  ) {
    return "Your session expired. Reopen ShowSignal to refresh Locked and Interested shows.";
  }

  if (
    code === "42501" ||
    /row-level security|permission denied/i.test(message)
  ) {
    return "ShowSignal could not sync your concert plans because of a permissions (RLS) rule.";
  }

  if (message.trim()) {
    return message.trim();
  }

  return "Could not sync your concert plans from your account.";
}

function trackAttendance(
  show: TicketmasterShow,
  fromStatus: AttendanceStatus | null,
  toStatus: AttendanceStatus | null,
) {
  if (fromStatus === toStatus) {
    return;
  }
  void recordInteraction({
    kind: "attendance",
    eventId: show.id,
    artistIds: show.attractions.map((artist) => artist.id),
    venueId: show.venueId,
    fromStatus,
    toStatus,
  });
}

export function useSavedEvents() {
  const {
    user,
    ready: authReady,
    configured,
    error: authError,
  } = useAuth();
  const [state, setState] = useState<AttendanceState>(getAttendanceState);
  const [localReady, setLocalReady] = useState(isAttendanceReady);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const pendingIdsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    await ensureAttendanceLoaded();
    setState(getAttendanceState());
    setLocalReady(true);

    if (!configured) {
      setReady(true);
      return;
    }

    const supabase = getSupabaseClient();
    const remote = await loadAttendanceState(supabase);
    const merged = await mergeRemoteAttendance(remote);
    setState(merged);
    setError(null);
    setReady(true);
  }, [configured]);

  useEffect(() => {
    const sync = () => {
      setState(getAttendanceState());
      setLocalReady(isAttendanceReady());
    };
    const unsubscribe = subscribeAttendance(sync);
    sync();
    void ensureAttendanceLoaded();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void refresh().catch((loadError: unknown) => {
        if (!cancelled) {
          const hasLocal =
            Object.keys(getAttendanceState().records).length > 0;
          setError(hasLocal ? null : savedShowsLoadMessage(loadError));
          setReady(true);
        }
      });
    }, 0);

    const unsubscribe = subscribeUserLibrary(() => {
      void refresh().catch((loadError: unknown) => {
        if (!cancelled) {
          const hasLocal =
            Object.keys(getAttendanceState().records).length > 0;
          setError(hasLocal ? null : savedShowsLoadMessage(loadError));
        }
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [authReady, refresh, user?.id]);

  const goingShows = useMemo(
    () => showsWithStatus(state, "going"),
    [state],
  );
  const interestedShows = useMemo(
    () => showsWithStatus(state, "interested"),
    [state],
  );
  const shows = useMemo(
    () => [...goingShows, ...interestedShows],
    [goingShows, interestedShows],
  );
  const savedIds = useMemo(
    () => new Set(shows.map((show) => show.id)),
    [shows],
  );

  async function persistRemote(
    show: TicketmasterShow,
    nextStatus: AttendanceStatus | null,
    calendar: CalendarLink | null,
  ) {
    if (!configured || !user?.id) {
      return;
    }
    const supabase = getSupabaseClient();
    if (!nextStatus) {
      await unsaveTicketmasterEvent(supabase, user.id, show.id);
      return;
    }
    await saveTicketmasterEvent(supabase, user.id, show, {
      attendanceStatus: nextStatus,
      calendar,
    });
  }

  async function setStatus(
    show: TicketmasterShow,
    nextStatus: AttendanceStatus | null,
    options?: { offerCalendar?: boolean },
  ): Promise<SetAttendanceResult> {
    if (pendingIdsRef.current.has(show.id)) {
      return { ok: false };
    }

    const previous = statusFor(state, show.id);
    if (previous === nextStatus) {
      const alreadyCalendared = !shouldWriteCalendarEvent(
        calendarLinkFor(state, show.id),
      );
      const canCalendar =
        nextStatus === "going" &&
        !alreadyCalendared &&
        buildCalendarEvent(show, websiteOrigin()).ok;
      return {
        ok: true,
        status: nextStatus,
        offerCalendar: Boolean(options?.offerCalendar) && canCalendar,
      };
    }

    if (!configured) {
      setError(
        "Saving is not connected. Check the Supabase values in mobile/.env and restart Expo.",
      );
      return { ok: false };
    }

    if (!user?.id) {
      setError(
        "Your guest account is still connecting. Wait a moment and try again.",
      );
      return { ok: false };
    }

    pendingIdsRef.current.add(show.id);
    setPendingIds(new Set(pendingIdsRef.current));
    setError(null);

    const previousState = state;
    const optimistic = applyAttendanceStatus(state, show, nextStatus);
    setState(optimistic);
    await writeAttendanceStatus(show, nextStatus);
    trackAttendance(show, previous, nextStatus);

    try {
      await persistRemote(
        show,
        nextStatus,
        calendarLinkFor(optimistic, show.id),
      );
      const alreadyCalendared = !shouldWriteCalendarEvent(
        calendarLinkFor(optimistic, show.id),
      );
      const canCalendar =
        nextStatus === "going" &&
        previous !== "going" &&
        !alreadyCalendared &&
        buildCalendarEvent(show, websiteOrigin()).ok;
      const offerCalendar = options?.offerCalendar !== false && canCalendar;
      return { ok: true, status: nextStatus, offerCalendar };
    } catch {
      setState(previousState);
      await writeAttendanceStatus(show, previous);
      trackAttendance(show, nextStatus, previous);
      setError(
        nextStatus
          ? "Could not update that show. Try again."
          : "Could not remove that show. Try again.",
      );
      return { ok: false };
    } finally {
      pendingIdsRef.current.delete(show.id);
      setPendingIds(new Set(pendingIdsRef.current));
    }
  }

  async function tapStatus(show: TicketmasterShow, tapped: AttendanceStatus) {
    const current = statusFor(state, show.id);
    const next = nextExclusiveStatus(current, tapped);
    const result = await setStatus(show, next);
    if (result.ok && result.offerCalendar) {
      promptAddToCalendar(show, addToCalendar);
    }
    return result;
  }

  async function tapGoingFromCard(show: TicketmasterShow) {
    const current = statusFor(state, show.id);
    if (current === "going") {
      return {
        ok: true as const,
        status: "going" as const,
        offerCalendar: false,
      };
    }
    const result = await setStatus(show, "going");
    if (result.ok && result.offerCalendar) {
      promptAddToCalendar(show, addToCalendar);
    }
    return result;
  }

  async function addToCalendar(show: TicketmasterShow): Promise<AddToCalendarResult> {
    const existing = calendarLinkFor(state, show.id);
    const result = await addShowToCalendar(show, existing);
    if (!result.ok) {
      setError(result.message);
      return result;
    }
    if (result.skipped) {
      return result;
    }
    const next = await writeCalendarLink(show, result.link);
    setState(next);
    if (configured && user?.id) {
      try {
        await updateSavedEventCalendar(
          getSupabaseClient(),
          user.id,
          show.id,
          result.link,
        );
      } catch {
        // Local native event id is enough to prevent a duplicate add.
      }
    }
    return result;
  }

  async function toggleSaved(show: TicketmasterShow) {
    const current = statusFor(state, show.id);
    await setStatus(show, current ? null : "interested", {
      offerCalendar: false,
    });
  }

  return {
    state,
    shows,
    goingShows,
    interestedShows,
    savedIds,
    ready: ready || localReady,
    error: error ?? authError,
    configured,
    statusFor: (id: string) => statusFor(state, id),
    calendarLinkFor: (id: string) => calendarLinkFor(state, id),
    setStatus,
    tapStatus,
    tapGoingFromCard,
    addToCalendar,
    toggleSaved,
    isPending: (id: string) => pendingIds.has(id),
    refresh,
  };
}
