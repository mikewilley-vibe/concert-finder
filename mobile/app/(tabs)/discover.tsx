import { useEffect, useRef, useState } from "react";
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
import { Field } from "@/components/Field";
import { FollowPill } from "@/components/FollowPill";
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
  searchVenues,
  type TicketmasterAttraction,
  type TicketmasterVenue,
} from "@/lib/api";
import {
  favoritesProgress,
} from "@/lib/favorites-progress";
import {
  openLocationSettings,
  requestCurrentHomeLocation,
} from "@/lib/current-location";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  MAX_MONITORED_FOLLOWS,
  type FollowedItemType,
} from "@/lib/follows";
import {
  RADIUS_OPTIONS,
  hasActiveSearchLocation,
  radiusLine,
  showingNearLine,
} from "@/lib/home-location";
import {
  loadOnboardingSuggestions,
  type OnboardingSuggestions,
} from "@/lib/onboarding-suggestions";

// Ticketmaster genre-based "More like…" / related-artist recommendations
// are paused until a better source exists. searchRecommendations and
// /api/v1/ticketmaster/recommendations stay in the repo unused.

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      attractions: TicketmasterAttraction[];
      venues: TicketmasterVenue[];
    };

type SuggestionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | ({ status: "ready" } & OnboardingSuggestions);

function venueSubtitle(venue: { city?: string | null; state?: string | null }) {
  return [venue.city, venue.state].filter(Boolean).join(", ") || "Venue";
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
  const [postalDraft, setPostalDraft] = useState("");
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [suggestionReload, setSuggestionReload] = useState(0);
  const [suggestions, setSuggestions] = useState<SuggestionState>({
    status: "idle",
  });
  const [listNotice, setListNotice] = useState<string | null>(null);
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const progress = favoritesProgress(
    follows.artists.length,
    follows.venues.length,
  );

  useEffect(() => {
    if (!home.ready) {
      return;
    }
    const timer = setTimeout(() => {
      setPostalDraft(
        home.location.homePostalCode || home.location.postalCode,
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [
    home.location.homePostalCode,
    home.location.postalCode,
    home.ready,
  ]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!home.ready || !hasActiveSearchLocation(home.location)) {
        setSuggestions({ status: "idle" });
        return;
      }
      setSuggestions({ status: "loading" });
      void loadOnboardingSuggestions({ location: home.location })
        .then((result) => {
          if (!cancelled) {
            setSuggestions({ status: "ready", ...result });
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setSuggestions({
              status: "error",
              message: apiErrorMessage(
                error,
                "Could not load suggestions right now. Try again.",
              ),
            });
          }
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [home.location, home.ready, suggestionReload]);

  function dismissKeyboard() {
    inputRef.current?.blur();
    Keyboard.dismiss();
  }

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

  async function onSaveArea() {
    dismissKeyboard();
    const postalCode = postalDraft.trim().toUpperCase();
    if (!postalCode) {
      setLocationNotice("Enter a ZIP or postal code like 23220.");
      return;
    }
    setLocationPending(true);
    setLocationNotice(null);
    setGpsDenied(false);
    const saved = await home.save({
      ...home.location,
      postalCode,
      homePostalCode: postalCode,
      homePlaceLabel: "",
      homeLatitude: null,
      homeLongitude: null,
      source: "home",
    });
    setLocationPending(false);
    setLocationNotice(
      saved
        ? `Showing suggestions near ${postalCode}.`
        : "Use a ZIP or postal code like 23220.",
    );
  }

  async function onUseCurrentLocation() {
    dismissKeyboard();
    setLocationPending(true);
    setLocationNotice(null);
    setGpsDenied(false);
    const result = await requestCurrentHomeLocation();
    if (!result.ok) {
      setLocationPending(false);
      setGpsDenied(result.code === "denied");
      setLocationNotice(result.message);
      return;
    }
    const saved = await home.save({
      ...home.location,
      postalCode: result.location.postalCode,
      latitude: result.location.latitude,
      longitude: result.location.longitude,
      placeLabel: result.location.placeLabel,
      source: "current",
    });
    setLocationPending(false);
    setLocationNotice(
      saved
        ? "Using your current location for suggestions."
        : "Could not save that location. Try again.",
    );
  }

  async function onSetRadius(radiusMiles: number) {
    setLocationNotice(null);
    await home.save({ ...home.location, radiusMiles });
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
        <Eyebrow>Find</Eyebrow>
        <Title>Build your concert radar.</Title>
        <Body>
          Pick a few nearby venues and artists. No account is required — your
          choices stay with your guest profile unless you decide to sign in.
        </Body>
      </ScreenBlock>

      <View style={styles.card}>
        <Strong>1. Choose your area</Strong>
        <Body>
          Use your location or enter a ZIP. You can change this anytime.
        </Body>
        {home.ready && hasActiveSearchLocation(home.location) ? (
          <View style={styles.locationSummary}>
            <Text style={styles.locationTitle}>
              {showingNearLine(home.location)}
            </Text>
            <Body>{radiusLine(home.location)}</Body>
          </View>
        ) : null}
        <Button
          label="Use current location"
          busy={locationPending}
          onPress={() => {
            void onUseCurrentLocation();
          }}
        />
        {gpsDenied ? (
          <Button
            label="Open Settings"
            variant="secondary"
            onPress={openLocationSettings}
          />
        ) : null}
        <Field
          label="ZIP or postal code"
          value={postalDraft}
          onChangeText={setPostalDraft}
          placeholder="23220"
          autoCapitalize="characters"
          returnKeyType="done"
          onSubmitEditing={() => {
            void onSaveArea();
          }}
        />
        <Button
          label="Use this ZIP"
          variant="secondary"
          busy={locationPending}
          onPress={() => {
            void onSaveArea();
          }}
        />
        <Body>Search radius</Body>
        <View style={styles.radiusOptions}>
          {RADIUS_OPTIONS.map((miles) => {
            const selected = home.location.radiusMiles === miles;
            return (
              <Pressable
                key={miles}
                accessibilityRole="button"
                accessibilityLabel={`${miles} mile radius`}
                accessibilityState={{ selected }}
                onPress={() => {
                  void onSetRadius(miles);
                }}
                style={({ pressed }) => [
                  styles.radiusPill,
                  selected && styles.radiusPillSelected,
                  pressed && styles.radiusPillPressed,
                ]}
              >
                <Text
                  style={[
                    styles.radiusLabel,
                    selected && styles.radiusLabelSelected,
                  ]}
                >
                  {miles} mi
                </Text>
              </Pressable>
            );
          })}
        </View>
        {locationNotice ? <Body>{locationNotice}</Body> : null}
        {home.error ? <Body>{home.error}</Body> : null}
      </View>

      <ScreenBlock>
        <Strong>2. Tap some favorites</Strong>
        <View style={styles.progressRow}>
          <Text style={styles.progress}>{progress.artistLabel}</Text>
          <Text style={styles.progress}>{progress.venueLabel}</Text>
        </View>
        {!follows.ready ? (
          <Body>Your guest profile is connecting…</Body>
        ) : null}
      </ScreenBlock>

      {!home.ready ? <LoadingBlock label="Loading your area…" /> : null}

      {home.ready && suggestions.status === "idle" ? (
        <EmptyState
          title="Choose an area for suggestions"
          body="Use your current location or enter a ZIP above."
        />
      ) : null}

      {suggestions.status === "loading" ? (
        <LoadingBlock label="Finding nearby favorites…" />
      ) : null}

      {suggestions.status === "error" ? (
        <EmptyState
          title="Suggestions didn’t load"
          body={suggestions.message}
          action={
            <Button
              label="Try again"
              onPress={() => setSuggestionReload((value) => value + 1)}
            />
          }
        />
      ) : null}

      {suggestions.status === "ready" &&
      suggestions.venues.length === 0 &&
      suggestions.artists.length === 0 ? (
        <EmptyState
          title="No nearby suggestions yet"
          body="Try a wider radius, another ZIP, or search by name below."
        />
      ) : null}

      {suggestions.status === "ready" && suggestions.venues.length > 0 ? (
        <ScreenBlock>
          <Strong>Nearby venues with upcoming shows</Strong>
          <View style={styles.pills}>
            {suggestions.venues.map((venue) => {
              const followed = follows.isFollowed(
                FOLLOWED_VENUE_TYPE,
                venue.id,
              );
              return (
                <FollowPill
                  key={venue.id}
                  label={venue.name}
                  meta={venue.meta}
                  selected={followed}
                  pending={follows.isPending(FOLLOWED_VENUE_TYPE, venue.id)}
                  disabled={!follows.ready}
                  onPress={() => {
                    void onToggleFollow(
                      FOLLOWED_VENUE_TYPE,
                      { item_key: venue.id, item_label: venue.name },
                      followed,
                    );
                  }}
                />
              );
            })}
          </View>
        </ScreenBlock>
      ) : null}

      {suggestions.status === "ready" && suggestions.artists.length > 0 ? (
        <ScreenBlock>
          <Strong>Artists playing near you</Strong>
          <View style={styles.pills}>
            {suggestions.artists.map((artist) => {
              const followed = follows.isFollowed(
                FOLLOWED_ATTRACTION_TYPE,
                artist.id,
              );
              return (
                <FollowPill
                  key={artist.id}
                  label={artist.name}
                  meta={artist.meta}
                  selected={followed}
                  pending={follows.isPending(
                    FOLLOWED_ATTRACTION_TYPE,
                    artist.id,
                  )}
                  disabled={!follows.ready}
                  onPress={() => {
                    void onToggleFollow(
                      FOLLOWED_ATTRACTION_TYPE,
                      { item_key: artist.id, item_label: artist.name },
                      followed,
                    );
                  }}
                />
              );
            })}
          </View>
        </ScreenBlock>
      ) : null}

      <View style={styles.search}>
        <Strong>3. Search for anyone else</Strong>
        <Body>Type part of a name. We’ll include close suggestions too.</Body>
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
        <Body style={styles.limitNote}>
          You can follow up to {MAX_MONITORED_FOLLOWS} artists and venues combined.
        </Body>
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
                  accessibilityLabel={`View upcoming shows at ${venue.name}`}
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
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
  },
  locationSummary: {
    gap: 2,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  locationTitle: {
    color: colors.foreground,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  radiusOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  radiusPill: {
    minHeight: 44,
    minWidth: 66,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radiusPillSelected: {
    borderColor: colors.accent,
    backgroundColor: "#252b1e",
  },
  radiusPillPressed: {
    opacity: 0.75,
  },
  radiusLabel: {
    color: colors.foreground,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  radiusLabelSelected: {
    color: colors.accent,
  },
  progressRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  progress: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
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
  limitNote: {
    fontSize: 13,
  },
});
