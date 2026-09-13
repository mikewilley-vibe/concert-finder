import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowRow } from "@/components/ShowRow";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useFollows } from "@/hooks/useFollows";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import {
  apiErrorMessage,
  searchUpcomingShows,
  type TicketmasterShow,
} from "@/lib/api";
import { loadFollowedListingShows } from "@/lib/followed-listing-shows";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  type FollowedItemType,
} from "@/lib/follows";
import { shareListing } from "@/lib/share";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; shows: TicketmasterShow[]; capped: boolean };

export function FollowedDetailScreen({
  kind,
  id,
  name,
  place,
}: {
  kind: "artist" | "venue";
  id?: string;
  name?: string;
  place?: string;
}) {
  const follows = useFollows();
  const saved = useSavedEvents();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const requestIdRef = useRef(0);
  const itemType: FollowedItemType =
    kind === "artist" ? FOLLOWED_ATTRACTION_TYPE : FOLLOWED_VENUE_TYPE;
  const label = name?.trim() || (kind === "artist" ? "Artist" : "Venue");
  const followed = id ? follows.isFollowed(itemType, id) : false;

  const loadShows = useCallback(async () => {
    if (!id || !label) {
      setState({
        status: "error",
        message: "This page is missing an artist or venue id.",
      });
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState({ status: "loading" });
    try {
      const result = await loadFollowedListingShows({
        kind,
        id,
        label,
        search: searchUpcomingShows,
      });
      if (requestIdRef.current !== requestId) {
        return;
      }
      setState({
        status: "ready",
        shows: result.shows,
        capped: result.capped,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setState({
        status: "error",
        message: apiErrorMessage(
          error,
          "Could not load upcoming shows. Try again.",
        ),
      });
    }
  }, [id, kind, label]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadShows();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadShows]);

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>{kind === "artist" ? "Artist" : "Venue"}</Eyebrow>
        <Title>{label}</Title>
        {place ? <Body>{place}</Body> : null}
        {id ? (
          <>
            <Button
              label={followed ? "Following" : "Follow"}
              variant={followed ? "secondary" : "action"}
              disabled={follows.isPending(itemType, id)}
              accessibilityLabel={
                followed ? `Unfollow ${label}` : `Follow ${label}`
              }
              onPress={() => {
                void follows.toggleFollow(
                  itemType,
                  { item_key: id, item_label: label },
                  followed,
                );
              }}
            />
            <Button
              label={kind === "artist" ? "Share artist" : "Share venue"}
              variant="secondary"
              accessibilityLabel={`Share ${label}`}
              onPress={() => {
                void shareListing(kind, label, id);
              }}
            />
          </>
        ) : null}
        {follows.error ? <Body>{follows.error}</Body> : null}
      </ScreenBlock>

      {state.status === "loading" ? (
        <LoadingBlock label="Loading upcoming shows…" />
      ) : null}

      {state.status === "error" ? (
        <EmptyState
          title="Shows didn’t load"
          body={state.message}
          action={
            <Button
              label="Try again"
              onPress={() => {
                void loadShows();
              }}
            />
          }
        />
      ) : null}

      {state.status === "ready" && state.shows.length === 0 ? (
        <EmptyState
          title="No upcoming shows"
          body="Ticketmaster has no upcoming dates for this listing right now."
        />
      ) : null}

      {state.status === "ready" && state.shows.length > 0 ? (
        <ScreenBlock>
          <Strong>Upcoming shows</Strong>
          <Body>
            {state.shows.length === 1
              ? "1 upcoming Ticketmaster date."
              : `${state.shows.length} upcoming Ticketmaster dates.`}
            {state.capped
              ? " Showing the next dates Ticketmaster returned."
              : ""}
          </Body>
          {saved.error ? <Body>{saved.error}</Body> : null}
          {state.shows.map((show) => {
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
      ) : null}
    </Screen>
  );
}
