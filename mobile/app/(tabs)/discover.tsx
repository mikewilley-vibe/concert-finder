import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { colors, fonts } from "@/constants/theme";
import { useFollows } from "@/hooks/useFollows";
import { useHomeLocation } from "@/hooks/useHomeLocation";
import {
  apiErrorMessage,
  searchAttractions,
  searchRecommendations,
  searchVenues,
  type TicketmasterAttraction,
  type TicketmasterVenue,
} from "@/lib/api";
import { upcomingSearchFields } from "@/lib/home-location";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  type FollowedItemType,
} from "@/lib/follows";
import type { DiscoverySeed } from "@/lib/discovery-seeds";
import {
  loadDiscoverySeeds,
  saveDiscoverySeed,
} from "@/lib/discovery-seeds-store";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      attractions: TicketmasterAttraction[];
      venues: TicketmasterVenue[];
    };

type RecsState =
  | { status: "hidden" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      seedLabel: string;
      artists: Array<{
        id: string;
        name: string;
        reason: string;
      }>;
      venues: Array<{
        id: string;
        name: string;
        city: string | null;
        state: string | null;
        reason: string;
      }>;
    };

function venueSubtitle(venue: { city?: string | null; state?: string | null }) {
  return [venue.city, venue.state].filter(Boolean).join(", ") || "Venue";
}

function seedFromAttraction(
  artist: TicketmasterAttraction,
  source: DiscoverySeed["source"],
): DiscoverySeed | null {
  if (!artist.genreId && !artist.subGenreId) {
    return null;
  }
  return {
    id: artist.id,
    label: artist.name,
    genreId: artist.genreId ?? null,
    genreName: artist.genreName ?? null,
    subGenreId: artist.subGenreId ?? null,
    subGenreName: artist.subGenreName ?? null,
    savedAt: Date.now(),
    source,
  };
}

function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

export default function DiscoverScreen() {
  const router = useRouter();
  const follows = useFollows();
  const home = useHomeLocation();
  const inputRef = useRef<TextInput>(null);
  const [keyword, setKeyword] = useState("");
  const [listNotice, setListNotice] = useState<string | null>(null);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [recs, setRecs] = useState<RecsState>({ status: "hidden" });
  const searchIdsRef = useRef<Set<string>>(new Set());
  const followsRef = useRef(follows);
  const homeRef = useRef(home);

  useEffect(() => {
    followsRef.current = follows;
    homeRef.current = home;
  }, [follows, home]);

  function dismissKeyboard() {
    inputRef.current?.blur();
    Keyboard.dismiss();
  }

  const loadRecommendations = useCallback(
    async (seeds: DiscoverySeed[]) => {
      const usable = seeds.filter((seed) => seed.genreId || seed.subGenreId);
      if (usable.length === 0) {
        setRecs({ status: "hidden" });
        return;
      }
      setRecs({ status: "loading" });
      const followsNow = followsRef.current;
      const location = upcomingSearchFields(homeRef.current.location);
      try {
        const result = await searchRecommendations({
          seeds: usable.map((seed) => ({
            id: seed.id,
            label: seed.label,
            genreId: seed.genreId,
            genreName: seed.genreName,
            subGenreId: seed.subGenreId,
            subGenreName: seed.subGenreName,
          })),
          excludeAttractionIds: [
            ...followsNow.artists.map((item) => item.item_key),
            ...searchIdsRef.current,
          ],
          excludeVenueIds: followsNow.venues.map((item) => item.item_key),
          ...location,
        });
        if (
          !result.seedLabel ||
          (result.artists.length === 0 && result.venues.length === 0)
        ) {
          setRecs({ status: "hidden" });
          return;
        }
        setRecs({
          status: "ready",
          seedLabel: result.seedLabel,
          artists: result.artists,
          venues: result.venues,
        });
      } catch (error) {
        setRecs({
          status: "error",
          message: apiErrorMessage(
            error,
            "Could not load related shows right now.",
          ),
        });
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void loadDiscoverySeeds()
      .then((seeds) => {
        if (!cancelled) {
          return loadRecommendations(seeds);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecs({ status: "hidden" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadRecommendations]);

  async function onSearch() {
    dismissKeyboard();
    const query = keyword.trim();
    if (query.length < 2) {
      setState({
        status: "error",
        message: "Type at least two characters to search.",
      });
      return;
    }

    setState({ status: "loading" });
    setListNotice(null);

    try {
      const [attractionsResult, venuesResult] = await Promise.all([
        searchAttractions(query),
        searchVenues(query),
      ]);
      const seen = new Set(attractionsResult.attractions.map((item) => item.id));
      const attractions = [
        ...attractionsResult.attractions,
        ...attractionsResult.suggestions.filter((item) => !seen.has(item.id)),
      ];
      setState({
        status: "ready",
        attractions,
        venues: venuesResult.venues,
      });
      searchIdsRef.current = new Set(attractions.map((item) => item.id));
      const seed = attractions
        .map((artist) => seedFromAttraction(artist, "search"))
        .find((item): item is DiscoverySeed => Boolean(item));
      if (seed) {
        const seeds = await saveDiscoverySeed(seed);
        void loadRecommendations(seeds);
      }
    } catch (error) {
      setState({
        status: "error",
        message: apiErrorMessage(
          error,
          "Could not search right now. Try again.",
        ),
      });
    }
  }

  async function onToggleFollow(
    itemType: FollowedItemType,
    item: { item_key: string; item_label: string },
    currentlyFollowed: boolean,
  ) {
    dismissKeyboard();
    setKeyword("");
    const result = await follows.toggleFollow(
      itemType,
      item,
      currentlyFollowed,
    );
    if (result.ok) {
      setListNotice(null);
      announce(
        result.followed
          ? `Following ${item.item_label}`
          : `Unfollowed ${item.item_label}`,
      );
      if (result.followed && itemType === FOLLOWED_ATTRACTION_TYPE) {
        const fromResults =
          state.status === "ready"
            ? state.attractions.find((artist) => artist.id === item.item_key)
            : undefined;
        const seed = fromResults
          ? seedFromAttraction(fromResults, "follow")
          : null;
        if (seed) {
          const seeds = await saveDiscoverySeed(seed);
          void loadRecommendations(seeds);
        }
      }
      return;
    }
    if (result.code === "pending") {
      return;
    }
    setListNotice(result.message);
    announce(result.message);
  }

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Discover</Eyebrow>
        <Title>Search artists, venues, and upcoming shows.</Title>
        <Body>
          Search for an artist or venue, then tap Follow. Their upcoming shows
          appear on Home.
        </Body>
      </ScreenBlock>

      <View style={styles.search}>
        <Strong>Search artists and venues</Strong>
        <TextInput
          ref={inputRef}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Artist or venue name"
          placeholderTextColor={colors.mute}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit
          accessibilityLabel="Search artists and venues"
          onSubmitEditing={() => {
            void onSearch();
          }}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          onPress={() => {
            void onSearch();
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Search</Text>
        </Pressable>
      </View>

      {follows.error && !listNotice ? (
        <EmptyState title="Follows didn’t load" body={follows.error} />
      ) : null}

      {listNotice ? (
        <EmptyState title="Couldn’t update follow" body={listNotice} />
      ) : null}

      {state.status === "idle" ? (
        <EmptyState
          title="Search to get started"
          body="Open an artist or venue to follow it and see upcoming dates."
        />
      ) : null}

      {state.status === "loading" ? (
        <LoadingBlock label="Searching…" />
      ) : null}

      {state.status === "error" ? (
        <EmptyState
          title="Search didn’t finish"
          body={state.message}
          action={
            <Button
              label="Try again"
              onPress={() => {
                void onSearch();
              }}
            />
          }
        />
      ) : null}

      {state.status === "ready" &&
      state.attractions.length === 0 &&
      state.venues.length === 0 ? (
        <EmptyState
          title="No matches"
          body="Try a different artist or venue name."
        />
      ) : null}

      {state.status === "ready" && state.attractions.length > 0 ? (
        <ScreenBlock>
          <Strong>Artists</Strong>
          {state.attractions.map((artist) => {
            const followed = follows.isFollowed(
              FOLLOWED_ATTRACTION_TYPE,
              artist.id,
            );
            const rowError = follows.itemError(
              FOLLOWED_ATTRACTION_TYPE,
              artist.id,
            );
            return (
              <View key={artist.id} style={styles.result}>
                <ListRow
                  title={artist.name}
                  subtitle="Artist"
                  onPress={() =>
                    router.push({
                      pathname: "/artist/[id]",
                      params: { id: artist.id, name: artist.name },
                    })
                  }
                  trailing={
                    <Button
                      label={followed ? "Following" : "Follow"}
                      variant={followed ? "secondary" : "action"}
                      busy={follows.isPending(
                        FOLLOWED_ATTRACTION_TYPE,
                        artist.id,
                      )}
                      accessibilityLabel={
                        followed
                          ? `Unfollow ${artist.name}`
                          : `Follow ${artist.name}`
                      }
                      onPress={() => {
                        void onToggleFollow(
                          FOLLOWED_ATTRACTION_TYPE,
                          { item_key: artist.id, item_label: artist.name },
                          followed,
                        );
                      }}
                    />
                  }
                />
                {rowError ? <Body style={styles.rowError}>{rowError}</Body> : null}
              </View>
            );
          })}
        </ScreenBlock>
      ) : null}

      {state.status === "ready" && state.venues.length > 0 ? (
        <ScreenBlock>
          <Strong>Venues</Strong>
          {state.venues.map((venue) => {
            const followed = follows.isFollowed(
              FOLLOWED_VENUE_TYPE,
              venue.id,
            );
            const place = venueSubtitle(venue);
            const rowError = follows.itemError(FOLLOWED_VENUE_TYPE, venue.id);
            return (
              <View key={venue.id} style={styles.result}>
                <ListRow
                  title={venue.name}
                  subtitle={place}
                  onPress={() =>
                    router.push({
                      pathname: "/venue/[id]",
                      params: {
                        id: venue.id,
                        name: venue.name,
                        city: venue.city ?? "",
                        state: venue.state ?? "",
                      },
                    })
                  }
                  trailing={
                    <Button
                      label={followed ? "Following" : "Follow"}
                      variant={followed ? "secondary" : "action"}
                      busy={follows.isPending(FOLLOWED_VENUE_TYPE, venue.id)}
                      accessibilityLabel={
                        followed
                          ? `Unfollow ${venue.name}`
                          : `Follow ${venue.name}`
                      }
                      onPress={() => {
                        void onToggleFollow(
                          FOLLOWED_VENUE_TYPE,
                          { item_key: venue.id, item_label: venue.name },
                          followed,
                        );
                      }}
                    />
                  }
                />
                {rowError ? <Body style={styles.rowError}>{rowError}</Body> : null}
              </View>
            );
          })}
        </ScreenBlock>
      ) : null}

      {recs.status === "loading" ? (
        <LoadingBlock label="Finding similar shows…" />
      ) : null}

      {recs.status === "error" ? (
        <EmptyState
          title="Related shows didn’t load"
          body={recs.message}
          action={
            <Button
              label="Try again"
              onPress={() => {
                void loadDiscoverySeeds().then(loadRecommendations);
              }}
            />
          }
        />
      ) : null}

      {recs.status === "ready" && recs.artists.length > 0 ? (
        <ScreenBlock>
          <Strong>More like {recs.seedLabel}</Strong>
          <Body>
            Artists from upcoming Ticketmaster dates in the same genre, excluding
            people you already follow.
          </Body>
          {recs.artists.map((artist) => {
            const followed = follows.isFollowed(
              FOLLOWED_ATTRACTION_TYPE,
              artist.id,
            );
            const rowError = follows.itemError(
              FOLLOWED_ATTRACTION_TYPE,
              artist.id,
            );
            return (
              <View key={`rec-artist-${artist.id}`} style={styles.result}>
                <ListRow
                  title={artist.name}
                  subtitle={artist.reason}
                  onPress={() =>
                    router.push({
                      pathname: "/artist/[id]",
                      params: { id: artist.id, name: artist.name },
                    })
                  }
                  trailing={
                    <Button
                      label={followed ? "Following" : "Follow"}
                      variant={followed ? "secondary" : "action"}
                      busy={follows.isPending(
                        FOLLOWED_ATTRACTION_TYPE,
                        artist.id,
                      )}
                      accessibilityLabel={
                        followed
                          ? `Unfollow ${artist.name}`
                          : `Follow ${artist.name}`
                      }
                      onPress={() => {
                        void onToggleFollow(
                          FOLLOWED_ATTRACTION_TYPE,
                          { item_key: artist.id, item_label: artist.name },
                          followed,
                        );
                      }}
                    />
                  }
                />
                {rowError ? <Body style={styles.rowError}>{rowError}</Body> : null}
              </View>
            );
          })}
        </ScreenBlock>
      ) : null}

      {recs.status === "ready" && recs.venues.length > 0 ? (
        <ScreenBlock>
          <Strong>Venues with similar shows near you</Strong>
          <Body>
            Rooms hosting upcoming dates in that same genre, when Ticketmaster
            has a match near your home area.
          </Body>
          {recs.venues.map((venue) => {
            const followed = follows.isFollowed(FOLLOWED_VENUE_TYPE, venue.id);
            const rowError = follows.itemError(FOLLOWED_VENUE_TYPE, venue.id);
            return (
              <View key={`rec-venue-${venue.id}`} style={styles.result}>
                <ListRow
                  title={venue.name}
                  subtitle={venue.reason}
                  onPress={() =>
                    router.push({
                      pathname: "/venue/[id]",
                      params: {
                        id: venue.id,
                        name: venue.name,
                        city: venue.city ?? "",
                        state: venue.state ?? "",
                      },
                    })
                  }
                  trailing={
                    <Button
                      label={followed ? "Following" : "Follow"}
                      variant={followed ? "secondary" : "action"}
                      busy={follows.isPending(FOLLOWED_VENUE_TYPE, venue.id)}
                      accessibilityLabel={
                        followed
                          ? `Unfollow ${venue.name}`
                          : `Follow ${venue.name}`
                      }
                      onPress={() => {
                        void onToggleFollow(
                          FOLLOWED_VENUE_TYPE,
                          { item_key: venue.id, item_label: venue.name },
                          followed,
                        );
                      }}
                    />
                  }
                />
                {rowError ? <Body style={styles.rowError}>{rowError}</Body> : null}
              </View>
            );
          })}
        </ScreenBlock>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    gap: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    color: "#ffffff",
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 16,
  },
  button: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.accentDeep,
  },
  buttonLabel: {
    color: colors.onAccent,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  result: {
    gap: 6,
  },
  rowError: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    paddingHorizontal: 4,
  },
});
