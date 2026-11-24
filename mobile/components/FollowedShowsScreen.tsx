import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";

import { ActionLink } from "@/components/ActionLink";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FollowedItemPicker } from "@/components/FollowedItemPicker";
import { FollowedRoster } from "@/components/FollowedRoster";
import { GoingButton } from "@/components/GoingButton";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowRow } from "@/components/ShowRow";
import { ShowViewTabs } from "@/components/ShowViewTabs";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useFollows } from "@/hooks/useFollows";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import {
  apiErrorMessage,
  searchUpcomingShows,
  type TicketmasterShow,
} from "@/lib/api";
import {
  initialFavoriteShowCursors,
  loadFavoriteShowPage,
  mergeFavoriteShowPages,
  type FavoriteShowCursor,
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
  type FollowedItemType,
} from "@/lib/follows";
import { scanDateLabel } from "@/lib/show-windows";
import {
  applyShowListFilters,
  countShowsMissingCoordinates,
  showListFilterEmptyCopy,
  showListFilterResetLabel,
} from "@/lib/show-list-filters";
import { useShowListFilters } from "@/hooks/useShowListFilters";
import { ShowListFilterBar } from "@/components/ShowListFilterBar";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      shows: TicketmasterShow[];
      nextCursors: FavoriteShowCursor[];
    };

export function FollowedShowsScreen({ kind }: { kind: FavoriteShowKind }) {
  const params = useLocalSearchParams<{ view?: string | string[] }>();
  const router = useRouter();
  const routeView = Array.isArray(params.view) ? params.view[0] : params.view;
  const follows = useFollows();
  const saved = useSavedEvents();
  const view: FavoriteShowView = parseFavoriteShowView(routeView);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [selectedFollowKey, setSelectedFollowKey] = useState<string | null>(
    null,
  );
  const requestIdRef = useRef(0);
  const filters = useShowListFilters(kind === "artist" ? "artists" : "venues");

  const loadShows = useCallback(async () => {
    if (!follows.ready) {
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setState({ status: "loading" });
    setLoadMoreError(null);
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
          nextCursors: result.nextCursors,
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
  const selectedFollow = followed.find(
    (item) => item.item_key === selectedFollowKey,
  );
  const activeSelectedFollowKey = selectedFollow?.item_key ?? null;

  const filterPool = useMemo(() => {
    const loaded = state.status === "ready" ? state.shows : [];
    if (filters.dateFilter === "all" || activeSelectedFollowKey) {
      return favoriteShowsForView({
        kind,
        view,
        shows: loaded,
        follows: followed,
        selectedFollowKey: activeSelectedFollowKey,
      });
    }
    return allLoadedFavoriteShows(loaded);
  }, [
    activeSelectedFollowKey,
    filters.dateFilter,
    followed,
    kind,
    state,
    view,
  ]);
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
  const copy = selectedFollow
    ? {
        title: `${selectedFollow.item_label} upcoming shows`,
        body: `All upcoming dates currently returned for ${selectedFollow.item_label}.`,
        empty: `No upcoming shows were found for ${selectedFollow.item_label}.`,
      }
    : favoriteShowViewCopy(kind, view);
  const noun = kind === "artist" ? "artists" : "venues";

  function retry() {
    void loadShows();
  }

  async function loadMore() {
    if (
      loadingMore ||
      state.status !== "ready" ||
      state.nextCursors.length === 0
    ) {
      return;
    }
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await loadFavoriteShowPage({
        kind,
        cursors: state.nextCursors,
        search: searchUpcomingShows,
      });
      setState({
        status: "ready",
        shows: mergeFavoriteShowPages(state.shows, result.shows),
        nextCursors: result.nextCursors,
      });
    } catch (error) {
      setLoadMoreError(
        apiErrorMessage(
          error,
          "Could not load more followed shows. Try again.",
        ),
      );
    } finally {
      setLoadingMore(false);
    }
  }

  function renderShow(show: TicketmasterShow) {
    return (
      <ShowRow
        key={show.id}
        show={show}
        kicker={scanDateLabel(show)}
        followArtistId={
          kind === "artist" ? activeSelectedFollowKey : undefined
        }
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

  const filterEmpty = showListFilterEmptyCopy({
    dateFilter: filters.dateFilter,
    nearMe: filtered.nearMeApplied,
    radiusMiles: filters.radiusMiles,
    hiddenWithoutCoordinates: filtered.hiddenWithoutCoordinates,
    hiddenForDistance: filtered.hiddenForDistance,
  });

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>{kind === "artist" ? "Your artists" : "Your venues"}</Eyebrow>
        <Title>{copy.title}</Title>
        <Body>{copy.body}</Body>
        {follows.ready && followed.length > 0 ? (
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
              filters.dateFilter !== "all" && !activeSelectedFollowKey
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
        {follows.ready && followed.length > 0 ? (
          <FollowedRoster
            title={kind === "artist" ? "Artists you follow" : "Venues you follow"}
            empty={`No followed ${noun} yet. Search and tap Follow.`}
            items={followed}
            itemType={
              (kind === "artist"
                ? FOLLOWED_ATTRACTION_TYPE
                : FOLLOWED_VENUE_TYPE) satisfies FollowedItemType
            }
            isPending={follows.isPending}
            itemError={follows.itemError}
            onRemove={(item) => {
              void follows.toggleFollow(
                kind === "artist"
                  ? FOLLOWED_ATTRACTION_TYPE
                  : FOLLOWED_VENUE_TYPE,
                item,
                true,
              );
            }}
          />
        ) : null}
        {follows.ready && followed.length > 0 ? (
          <FollowedItemPicker
            kind={kind}
            items={followed}
            selectedKey={activeSelectedFollowKey}
            onSelect={(nextKey) => {
              setSelectedFollowKey(nextKey);
              setLoadMoreError(null);
            }}
          />
        ) : null}
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
            view === "week" ? (
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
            <View style={{ gap: 8 }}>
              <Button
                label={showListFilterResetLabel({
                  dateFilter: filters.dateFilter,
                  nearMe: filters.nearMe,
                })}
                onPress={filters.clearFilters}
              />
              {activeSelectedFollowKey && state.nextCursors.length > 0 ? (
                <Button
                  label="Load more dates"
                  busy={loadingMore}
                  onPress={() => {
                    void loadMore();
                  }}
                />
              ) : null}
            </View>
          }
        />
      ) : null}

      {state.status === "ready" && shows.length > 0 ? (
        <ScreenBlock>
          <Strong>{shows.length === 1 ? "1 show" : `${shows.length} shows`}</Strong>
          {filtered.nearMeApplied && filtered.hiddenWithoutCoordinates > 0 ? (
            <Body>
              {filtered.hiddenWithoutCoordinates === 1
                ? "1 show is hidden because that venue has no map location."
                : `${filtered.hiddenWithoutCoordinates} shows are hidden because those venues have no map location.`}
            </Body>
          ) : null}
          {saved.error ? <Body>{saved.error}</Body> : null}
          {shows.map(renderShow)}
          {loadMoreError ? <Body>{loadMoreError}</Body> : null}
          {activeSelectedFollowKey && state.nextCursors.length > 0 ? (
            <Button
              label="Load more dates"
              busy={loadingMore}
              onPress={() => {
                void loadMore();
              }}
            />
          ) : null}
        </ScreenBlock>
      ) : null}
    </Screen>
  );
}
