import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionLink } from "@/components/ActionLink";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FollowedListAccordion } from "@/components/FollowedListAccordion";
import { GoingButton } from "@/components/GoingButton";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowListFilterBar } from "@/components/ShowListFilterBar";
import { ShowRow } from "@/components/ShowRow";
import { ShowViewTabs } from "@/components/ShowViewTabs";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useFollows } from "@/hooks/useFollows";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { useShowListFilters } from "@/hooks/useShowListFilters";
import {
  apiErrorMessage,
  searchUpcomingShows,
  type TicketmasterShow,
} from "@/lib/api";
import {
  initialFavoriteShowCursors,
  loadFavoriteShowPage,
} from "@/lib/favorite-show-pages";
import {
  allLoadedFavoriteShows,
  favoriteShowsForView,
  favoriteShowViewCopy,
  parseFavoriteShowView,
  type FavoriteShowKind,
  type FavoriteShowView,
} from "@/lib/favorite-show-views";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  type FollowedItem,
  type FollowedItemType,
} from "@/lib/follows";
import {
  applyShowListFilters,
  countShowsMissingCoordinates,
  showListFilterEmptyCopy,
  showListFilterResetLabel,
} from "@/lib/show-list-filters";
import { scanDateLabel } from "@/lib/show-windows";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; shows: TicketmasterShow[] };

export function FollowedShowsScreen({ kind }: { kind: FavoriteShowKind }) {
  const params = useLocalSearchParams<{ view?: string | string[] }>();
  const router = useRouter();
  const routeView = Array.isArray(params.view) ? params.view[0] : params.view;
  const follows = useFollows();
  const saved = useSavedEvents();
  const view: FavoriteShowView = parseFavoriteShowView(routeView);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const requestIdRef = useRef(0);
  const filters = useShowListFilters(kind === "artist" ? "artists" : "venues");

  const loadShows = useCallback(async () => {
    if (!follows.ready) {
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState({ status: "loading" });
    try {
      const followed = kind === "artist" ? follows.artists : follows.venues;
      const result = await loadFavoriteShowPage({
        kind,
        cursors: initialFavoriteShowCursors(kind, followed),
        search: searchUpcomingShows,
      });
      if (requestIdRef.current === requestId) {
        setState({
          status: "ready",
          shows: result.shows,
        });
      }
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setState({
          status: "error",
          message: apiErrorMessage(
            error,
            "Could not load followed shows. Try again.",
          ),
        });
      }
    }
  }, [follows.artists, follows.ready, follows.venues, kind]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadShows();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadShows]);

  const followed = kind === "artist" ? follows.artists : follows.venues;
  const filterPool = useMemo(() => {
    const loaded = state.status === "ready" ? state.shows : [];
    if (filters.dateFilter === "all") {
      return favoriteShowsForView({
        kind,
        view,
        shows: loaded,
        follows: followed,
      });
    }
    return allLoadedFavoriteShows(loaded);
  }, [filters.dateFilter, followed, kind, state, view]);
  const filtered = useMemo(
    () =>
      applyShowListFilters(filterPool, {
        dateFilter: filters.dateFilter,
        nearMe: filters.nearMe && Boolean(filters.origin),
        origin: filters.origin,
      }),
    [filterPool, filters.dateFilter, filters.nearMe, filters.origin],
  );
  const shows = filtered.shows;
  const missingCoordinates = countShowsMissingCoordinates(
    shows,
    filters.origin,
  );
  const copy = favoriteShowViewCopy(kind, view);
  const noun = kind === "artist" ? "artists" : "venues";
  const followType = (
    kind === "artist" ? FOLLOWED_ATTRACTION_TYPE : FOLLOWED_VENUE_TYPE
  ) satisfies FollowedItemType;
  const filterEmpty = showListFilterEmptyCopy({
    dateFilter: filters.dateFilter,
    nearMe: filtered.nearMeApplied,
    radiusMiles: filters.radiusMiles,
    hiddenWithoutCoordinates: filtered.hiddenWithoutCoordinates,
    hiddenForDistance: filtered.hiddenForDistance,
  });
  const showRoster = follows.ready && followed.length > 0;

  function retry() {
    void loadShows();
  }

  function openFollowed(item: FollowedItem) {
    if (kind === "artist") {
      router.push({
        pathname: "/artist/[id]",
        params: { id: item.item_key, name: item.item_label },
      });
      return;
    }
    router.push({
      pathname: "/venue/[id]",
      params: { id: item.item_key, name: item.item_label },
    });
  }

  function renderShow(show: TicketmasterShow) {
    return (
      <ShowRow
        key={show.id}
        show={show}
        kicker={scanDateLabel(show)}
        trailing={
          <GoingButton
            going={saved.statusFor(show.id) === "going"}
            pending={saved.isPending(show.id)}
            name={show.name}
            onPress={() => {
              void saved.tapGoingFromCard(show);
            }}
          />
        }
      />
    );
  }

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>{kind === "artist" ? "Your artists" : "Your venues"}</Eyebrow>
        <Title>{copy.title}</Title>
        {showRoster ? (
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
            hint={
              filters.dateFilter !== "all"
                ? "This date filter uses every upcoming show in the tab, including dates outside This Week and Next."
                : null
            }
            distanceNote={
              filters.origin && missingCoordinates > 0 && !filtered.nearMeApplied
                ? "Distance stays hidden when a venue has no map coordinates."
                : null
            }
          />
        ) : null}
        <ShowViewTabs
          selected={view}
          onSelect={(nextView) => router.setParams({ view: nextView })}
        />
      </ScreenBlock>

      {!follows.ready || state.status === "loading" ? (
        <LoadingBlock label={`Loading your ${noun}…`} />
      ) : null}

      {follows.error ? (
        <EmptyState title="Follows didn’t load" body={follows.error} />
      ) : null}

      {state.status === "error" ? (
        <EmptyState
          title="Shows didn’t load"
          body={state.message}
          action={<Button label="Try again" onPress={retry} />}
        />
      ) : null}

      {state.status === "ready" && followed.length === 0 ? (
        <EmptyState
          title={`No followed ${noun} yet`}
          body={`Follow ${noun} in Discover and their upcoming shows will appear here.`}
          action={
            <ActionLink
              href="/discover"
              label={`Find ${noun}`}
              accessibilityLabel={`Find ${noun} to follow`}
            />
          }
        />
      ) : null}

      {state.status === "ready" &&
      followed.length > 0 &&
      filterPool.length === 0 ? (
        <EmptyState
          title="No shows in this view"
          body={copy.empty}
          action={
            view === "week" && filters.dateFilter === "all" ? (
              <Button
                label="Show next dates"
                onPress={() => router.setParams({ view: "next" })}
              />
            ) : (
              <ActionLink
                href="/discover"
                label={`Follow more ${noun}`}
                accessibilityLabel={`Find more ${noun} to follow`}
              />
            )
          }
        />
      ) : null}

      {state.status === "ready" &&
      followed.length > 0 &&
      filterPool.length > 0 &&
      shows.length === 0 ? (
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

      {state.status === "ready" && shows.length > 0 ? (
        <ScreenBlock>
          <Strong>{shows.length === 1 ? "1 show" : `${shows.length} shows`}</Strong>
          <Body>{copy.body}</Body>
          {filtered.nearMeApplied && filtered.hiddenWithoutCoordinates > 0 ? (
            <Body>
              {filtered.hiddenWithoutCoordinates === 1
                ? "1 show is hidden because that venue has no map location."
                : `${filtered.hiddenWithoutCoordinates} shows are hidden because those venues have no map location.`}
            </Body>
          ) : null}
          {saved.error ? <Body>{saved.error}</Body> : null}
          {shows.map(renderShow)}
        </ScreenBlock>
      ) : null}

      {showRoster ? (
        <FollowedListAccordion
          kind={kind}
          items={followed}
          itemType={followType}
          onOpen={openFollowed}
          isPending={follows.isPending}
          itemError={follows.itemError}
          onRemove={(item) => {
            void follows.toggleFollow(followType, item, true);
          }}
        />
      ) : null}
    </Screen>
  );
}
