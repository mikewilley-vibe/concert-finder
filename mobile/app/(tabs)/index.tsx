import { useCallback, useEffect, useRef, useState } from "react";

import { ActionLink } from "@/components/ActionLink";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowRow } from "@/components/ShowRow";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useAuth } from "@/components/AuthProvider";
import { useFollows } from "@/hooks/useFollows";
import { useHomeLocation } from "@/hooks/useHomeLocation";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import {
  apiErrorMessage,
  getEventDetails,
  searchUpcomingShows,
  type TicketmasterShow,
} from "@/lib/api";
import { isPermanentUser } from "@/lib/auth";
import { toFollowedRef } from "@/lib/follows";
import {
  hasGpsFix,
  homeLocationLabel,
  upcomingSearchFields,
} from "@/lib/home-location";
import { getSupabaseClient } from "@/lib/supabase";
import {
  WatchStateUnavailableError,
  latestCheckedAt,
  loadOwnWatchState,
  markOwnWatchStateSeen,
  uniqueNewEventIds,
  type WatchStateRow,
} from "@/lib/watch-state";

type UpcomingState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; shows: TicketmasterShow[] };

type InboxState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "unavailable"; message: string }
  | {
      status: "ready";
      rows: WatchStateRow[];
      shows: TicketmasterShow[];
      markSeenError: string | null;
      marking: boolean;
    };

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

export default function HomeScreen() {
  const { user, ready: authReady, configured } = useAuth();
  const follows = useFollows();
  const saved = useSavedEvents();
  const home = useHomeLocation();
  const [upcoming, setUpcoming] = useState<UpcomingState>({ status: "loading" });
  const [inbox, setInbox] = useState<InboxState>({ status: "loading" });
  const upcomingRequest = useRef(0);
  const permanent = isPermanentUser(user);

  const loadUpcoming = useCallback(async () => {
    if (!follows.ready || !home.ready) {
      return;
    }

    if (follows.artists.length === 0 && follows.venues.length === 0) {
      setUpcoming({ status: "ready", shows: [] });
      return;
    }

    const requestId = upcomingRequest.current + 1;
    upcomingRequest.current = requestId;
    setUpcoming({ status: "loading" });
    try {
      const result = await searchUpcomingShows({
        attractions: follows.artists.map(toFollowedRef),
        venues: follows.venues.map(toFollowedRef),
        ...upcomingSearchFields(home.location),
      });
      if (upcomingRequest.current !== requestId) {
        return;
      }
      setUpcoming({ status: "ready", shows: result.shows });
    } catch (error) {
      if (upcomingRequest.current !== requestId) {
        return;
      }
      setUpcoming({
        status: "error",
        message: apiErrorMessage(
          error,
          "Could not load upcoming shows. Try again.",
        ),
      });
    }
  }, [
    follows.artists,
    follows.ready,
    follows.venues,
    home.location.latitude,
    home.location.longitude,
    home.location.postalCode,
    home.location.radiusMiles,
    home.ready,
  ]);

  const loadInbox = useCallback(async () => {
    if (!authReady) {
      return;
    }

    if (!configured) {
      setInbox({
        status: "unavailable",
        message: "Local Shows isn’t connected right now. Try again after a restart.",
      });
      return;
    }

    if (!permanent) {
      setInbox({ status: "guest" });
      return;
    }

    setInbox({ status: "loading" });
    try {
      const supabase = getSupabaseClient();
      const rows = await loadOwnWatchState(supabase);
      const ids = uniqueNewEventIds(rows).slice(0, 8);
      let shows: TicketmasterShow[] = [];
      if (ids.length > 0) {
        try {
          const details = await getEventDetails(ids);
          shows = details.shows;
        } catch {
          shows = [];
        }
      }
      setInbox({
        status: "ready",
        rows,
        shows,
        markSeenError: null,
        marking: false,
      });
    } catch (error) {
      if (error instanceof WatchStateUnavailableError) {
        setInbox({
          status: "unavailable",
          message:
            "New dates could not be checked yet. Upcoming shows below may still load.",
        });
        return;
      }
      setInbox({
        status: "unavailable",
        message: apiErrorMessage(
          error,
          "Could not load new dates. Upcoming shows below may still work.",
        ),
      });
    }
  }, [authReady, configured, permanent]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUpcoming();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadUpcoming]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadInbox();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadInbox]);

  async function markAllSeen() {
    if (inbox.status !== "ready" || inbox.marking) {
      return;
    }

    const toClear = inbox.rows.filter((row) => row.new_event_ids.length > 0);
    setInbox({ ...inbox, marking: true, markSeenError: null });
    try {
      const supabase = getSupabaseClient();
      for (const row of toClear) {
        await markOwnWatchStateSeen(supabase, row.id);
      }
      await loadInbox();
    } catch {
      setInbox({
        ...inbox,
        marking: false,
        markSeenError:
          "Could not mark those shows as seen. Try again.",
      });
    }
  }

  const inboxCopy =
    inbox.status === "guest"
      ? "Save your account to receive new-show checks. Guest follows still show upcoming dates below."
      : inbox.status === "unavailable"
        ? inbox.message
        : inbox.status === "ready" && uniqueNewEventIds(inbox.rows).length === 0
          ? `No new announcements right now. Last check: ${formatCheckedAt(latestCheckedAt(inbox.rows))}.`
          : null;

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Local Shows</Eyebrow>
        <Title>New announcements and nights you follow.</Title>
        <Body>
          New dates land here, plus upcoming shows from artists and venues you
          follow. {homeLocationLabel(home.location)}
        </Body>
      </ScreenBlock>

      {inbox.status === "loading" ? (
        <LoadingBlock label="Checking for new shows…" />
      ) : inbox.status === "ready" &&
        uniqueNewEventIds(inbox.rows).length > 0 ? (
        <ScreenBlock>
          <Strong>New shows</Strong>
          <Body>
            Newly found dates from the people you follow. Last check:{" "}
            {formatCheckedAt(latestCheckedAt(inbox.rows))}.
          </Body>
          {inbox.markSeenError ? <Body>{inbox.markSeenError}</Body> : null}
          {inbox.shows.map((show) => (
            <ShowRow key={show.id} show={show} />
          ))}
          {inbox.shows.length === 0 ? (
            <Body>
              New dates are waiting, but those concert details could not load.
              Try again in a moment.
            </Body>
          ) : null}
          <Button
            label={inbox.marking ? "Marking seen…" : "Mark as seen"}
            variant="secondary"
            disabled={inbox.marking}
            onPress={() => {
              void markAllSeen();
            }}
          />
        </ScreenBlock>
      ) : (
        <EmptyState
          title="No new announcements yet"
          body={
            inboxCopy ??
            "When a followed artist or venue gets a new date, it will land here."
          }
          action={
            <ActionLink
              href="/discover"
              label="Find artists and venues"
              accessibilityLabel="Find artists and venues"
            />
          }
        />
      )}

      {follows.error ? (
        <EmptyState title="Follows didn’t load" body={follows.error} />
      ) : null}

      {!follows.ready ? (
        <LoadingBlock label="Loading follows…" />
      ) : upcoming.status === "loading" ? (
        <LoadingBlock label="Loading upcoming shows…" />
      ) : upcoming.status === "error" ? (
        <EmptyState
          title="Upcoming shows didn’t load"
          body={upcoming.message}
          action={
            <Button
              label="Try again"
              onPress={() => {
                void loadUpcoming();
              }}
            />
          }
        />
      ) : follows.artists.length === 0 && follows.venues.length === 0 ? (
        <EmptyState
          title="No upcoming shows yet"
          body="Follow an artist or venue in Discover. Their next Ticketmaster dates will appear here."
          action={
            <ActionLink
              href="/discover"
              label="Find artists and venues"
              accessibilityLabel="Find artists and venues"
            />
          }
        />
      ) : upcoming.shows.length === 0 ? (
        <EmptyState
          title="No upcoming shows yet"
          body={
            home.location.postalCode || hasGpsFix(home.location)
              ? "Nothing nearby for this area. Try a wider radius in Profile, or follow another artist."
              : "Nothing upcoming for the people you follow right now."
          }
        />
      ) : (
        <ScreenBlock>
          <Strong>Upcoming from follows</Strong>
          <Body>{homeLocationLabel(home.location)}</Body>
          {saved.error ? <Body>{saved.error}</Body> : null}
          {upcoming.shows.map((show) => {
            const isSaved = saved.savedIds.has(show.id);
            return (
              <ShowRow
                key={show.id}
                show={show}
                trailing={
                  <Button
                    label={isSaved ? "Saved" : "Save"}
                    variant={isSaved ? "secondary" : "action"}
                    disabled={saved.isPending(show.id)}
                    accessibilityLabel={
                      isSaved
                        ? `Remove ${show.name} from saved`
                        : `Save ${show.name}`
                    }
                    onPress={() => {
                      void saved.toggleSaved(show);
                    }}
                  />
                }
              />
            );
          })}
        </ScreenBlock>
      )}
    </Screen>
  );
}
