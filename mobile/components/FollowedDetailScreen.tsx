import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FollowToggleButton } from "@/components/FollowToggleButton";
import { GoingButton } from "@/components/GoingButton";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowListFilterBar } from "@/components/ShowListFilterBar";
import { ShowRow } from "@/components/ShowRow";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useFollows } from "@/hooks/useFollows";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { useShowListFilters } from "@/hooks/useShowListFilters";
import {
  apiErrorMessage,
  searchUpcomingShows,
  type TicketmasterShow,
} from "@/lib/api";
import { loadFollowedListingShows } from "@/lib/followed-listing-shows";
import {
  applyShowListFilters,
  countShowsMissingCoordinates,
  showListFilterEmptyCopy,
  showListFilterResetLabel,
} from "@/lib/show-list-filters";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  type FollowedItemType,
} from "@/lib/follows";
import { shareListing } from "@/lib/share";
import { scanDateLabel } from "@/lib/show-windows";

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
  const filters = useShowListFilters(
    kind === "artist" ? "artist-detail" : "venue-detail",
  );
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

  const filtered = useMemo(() => {
    const loadedShows = state.status === "ready" ? state.shows : [];
    return applyShowListFilters(loadedShows, {
      dateFilter: filters.dateFilter,
      nearMe: filters.nearMe && Boolean(filters.origin),
      origin: filters.origin,
    });
  }, [filters.dateFilter, filters.nearMe, filters.origin, state]);
  const missingCoordinates = countShowsMissingCoordinates(
    filtered.shows,
    filters.origin,
  );
  const filterEmpty = showListFilterEmptyCopy({
    dateFilter: filters.dateFilter,
    nearMe: filtered.nearMeApplied,
    radiusMiles: filters.radiusMiles,
    hiddenWithoutCoordinates: filtered.hiddenWithoutCoordinates,
    hiddenForDistance: filtered.hiddenForDistance,
  });

  return (
    <Screen>
      <Stack.Screen options={{ title: label, headerBackTitle: "Back" }} />
      <ScreenBlock>
        <Eyebrow>{kind === "artist" ? "Artist" : "Venue"}</Eyebrow>
        <Title>{label}</Title>
        {place ? <Body>{place}</Body> : null}
        {id ? (
          <>
            <FollowToggleButton
              name={label}
              followed={followed}
              busy={follows.isPending(itemType, id)}
              onToggle={() => {
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
        {state.status === "ready" && state.shows.length > 0 ? (
          <ShowListFilterBar
            dateFilter={filters.dateFilter}
            onDateFilter={filters.setDateFilter}
            nearMe={filters.nearMe}
            onToggleNearMe={() => {
              void filters.toggleNearMe();
            }}
            locating={filters.locating}
            notice={filters.notice}
            denied={filters.denied}
            nearLabel={filters.nearLabel}
            distanceNote={
              filters.origin && missingCoordinates > 0 && !filtered.nearMeApplied
                ? "Distance stays hidden when a venue has no map coordinates."
                : null
            }
          />
        ) : null}
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

      {state.status === "ready" &&
      state.shows.length > 0 &&
      filtered.shows.length === 0 ? (
        <EmptyState
          title={filterEmpty.title}
          body={filterEmpty.body}
          action={
            <Button
              label={showListFilterResetLabel({
                dateFilter: filters.dateFilter,
                nearMe: filters.nearMe,
              })}
              onPress={filters.clearFilters}
            />
          }
        />
      ) : null}

      {state.status === "ready" && filtered.shows.length > 0 ? (
        <ScreenBlock>
          <Strong>Upcoming shows</Strong>
          <Body>
            {filtered.shows.length === 1
              ? "1 upcoming Ticketmaster date."
              : `${filtered.shows.length} upcoming Ticketmaster dates.`}
            {state.capped
              ? " Showing the next dates Ticketmaster returned."
              : ""}
          </Body>
          {filtered.nearMeApplied && filtered.hiddenWithoutCoordinates > 0 ? (
            <Body>
              {filtered.hiddenWithoutCoordinates === 1
                ? "1 show is hidden because that venue has no map location."
                : `${filtered.hiddenWithoutCoordinates} shows are hidden because those venues have no map location.`}
            </Body>
          ) : null}
          {saved.error ? <Body>{saved.error}</Body> : null}
          {filtered.shows.map((show) => {
            const going = saved.statusFor(show.id) === "going";
            return (
              <ShowRow
                key={show.id}
                show={show}
                kicker={scanDateLabel(show)}
                followArtistId={kind === "artist" ? id : undefined}
                trailing={
                  <GoingButton
                    going={going}
                    pending={saved.isPending(show.id)}
                    name={show.name}
                    onPress={() => {
                      void saved.tapGoingFromCard(show);
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
