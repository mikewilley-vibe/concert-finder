import { useRef, useState, type RefObject } from "react";
import {
  AccessibilityInfo,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { FollowedRoster } from "@/components/FollowedRoster";
import { ListRow } from "@/components/ListRow";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { colors, fonts } from "@/constants/theme";
import { useFollows } from "@/hooks/useFollows";
import {
  apiErrorMessage,
  searchAttractions,
  searchVenues,
  type TicketmasterAttraction,
  type TicketmasterVenue,
} from "@/lib/api";
import {
  FAVORITE_ARTIST_GOAL,
  FAVORITE_VENUE_GOAL,
} from "@/lib/favorites-progress";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  MAX_MONITORED_FOLLOWS,
  type FollowedItem,
  type FollowedItemType,
} from "@/lib/follows";

// Ticketmaster genre-based "More like…" / related-artist recommendations
// are paused until a better source exists. searchRecommendations and
// /api/v1/ticketmaster/recommendations stay in the repo unused.

type SearchMode = "artists" | "venues" | "following";

type ArtistSearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; attractions: TicketmasterAttraction[] };

type VenueSearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; venues: TicketmasterVenue[]; city: string };

function parseMode(value: string | undefined): SearchMode {
  if (value === "venues" || value === "following") {
    return value;
  }
  return "artists";
}

function venueSubtitle(venue: { city?: string | null; state?: string | null }) {
  return [venue.city, venue.state].filter(Boolean).join(", ") || "Venue";
}

function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const routeMode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const mode = parseMode(routeMode);
  const follows = useFollows();
  const artistInputRef = useRef<TextInput>(null);
  const venueInputRef = useRef<TextInput>(null);
  const [artistKeyword, setArtistKeyword] = useState("");
  const [venueKeyword, setVenueKeyword] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [listNotice, setListNotice] = useState<string | null>(null);
  const [artistState, setArtistState] = useState<ArtistSearchState>({
    status: "idle",
  });
  const [venueState, setVenueState] = useState<VenueSearchState>({
    status: "idle",
  });

  function dismissKeyboard() {
    artistInputRef.current?.blur();
    venueInputRef.current?.blur();
    Keyboard.dismiss();
  }

  function selectMode(next: SearchMode) {
    dismissKeyboard();
    router.setParams({ mode: next });
  }

  async function onSearchArtists() {
    dismissKeyboard();
    const query = artistKeyword.trim();
    if (query.length < 2) {
      setArtistState({
        status: "error",
        message: "Type at least two characters to search.",
      });
      return;
    }

    setArtistState({ status: "loading" });
    setListNotice(null);

    try {
      const attractionsResult = await searchAttractions(query);
      const seen = new Set(
        attractionsResult.attractions.map((item) => item.id),
      );
      const attractions = [
        ...attractionsResult.attractions,
        ...attractionsResult.suggestions.filter((item) => !seen.has(item.id)),
      ];
      setArtistState({ status: "ready", attractions });
    } catch (error) {
      setArtistState({
        status: "error",
        message: apiErrorMessage(
          error,
          "Could not search right now. Try again.",
        ),
      });
    }
  }

  async function onSearchVenues() {
    dismissKeyboard();
    const query = venueKeyword.trim();
    const city = venueCity.trim();
    if (query.length < 2) {
      setVenueState({
        status: "error",
        message: "Type at least two characters of the venue name.",
      });
      return;
    }
    if (city.length === 1) {
      setVenueState({
        status: "error",
        message: "Enter at least two characters for the city, or leave it blank.",
      });
      return;
    }

    setVenueState({ status: "loading" });
    setListNotice(null);

    try {
      const venuesResult = await searchVenues(query, city);
      setVenueState({
        status: "ready",
        venues: venuesResult.venues,
        city,
      });
    } catch (error) {
      setVenueState({
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
    item: FollowedItem,
    currentlyFollowed: boolean,
  ) {
    dismissKeyboard();
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
          : `Removed ${item.item_label}`,
      );
      return;
    }
    if (result.code === "pending") {
      return;
    }
    setListNotice(result.message);
    announce(result.message);
  }

  function removeFollow(itemType: FollowedItemType, item: FollowedItem) {
    void onToggleFollow(itemType, item, true);
  }

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Find</Eyebrow>
        <Title>Add artists and venues you want to follow.</Title>
        <Body>
          Search Ticketmaster, tap Follow, and their shows move up on Home.
          About {FAVORITE_ARTIST_GOAL} artists and {FAVORITE_VENUE_GOAL} venues
          is a great start. Tracking supports {MAX_MONITORED_FOLLOWS} follows
          combined.
        </Body>
        <View style={styles.modes}>
          <ModeButton
            label="Artists"
            selected={mode === "artists"}
            onPress={() => selectMode("artists")}
          />
          <ModeButton
            label="Venues"
            selected={mode === "venues"}
            onPress={() => selectMode("venues")}
          />
          <ModeButton
            label="Following"
            selected={mode === "following"}
            onPress={() => selectMode("following")}
          />
        </View>
      </ScreenBlock>

      {follows.error && !listNotice ? (
        <EmptyState title="Follows didn’t load" body={follows.error} />
      ) : null}

      {listNotice ? (
        <EmptyState title="Couldn’t update follow" body={listNotice} />
      ) : null}

      {mode === "artists" ? (
        <ArtistSearch
          inputRef={artistInputRef}
          keyword={artistKeyword}
          onChangeKeyword={setArtistKeyword}
          state={artistState}
          onSearch={() => {
            void onSearchArtists();
          }}
          follows={follows}
          onOpen={(artist) =>
            router.push({
              pathname: "/artist/[id]",
              params: { id: artist.id, name: artist.name },
            })
          }
          onToggle={(artist, followed) => {
            void onToggleFollow(
              FOLLOWED_ATTRACTION_TYPE,
              { item_key: artist.id, item_label: artist.name },
              followed,
            );
          }}
        />
      ) : null}

      {mode === "venues" ? (
        <VenueSearch
          inputRef={venueInputRef}
          keyword={venueKeyword}
          city={venueCity}
          onChangeKeyword={setVenueKeyword}
          onChangeCity={setVenueCity}
          state={venueState}
          onSearch={() => {
            void onSearchVenues();
          }}
          follows={follows}
          onOpen={(venue) =>
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
          onToggle={(venue, followed) => {
            void onToggleFollow(
              FOLLOWED_VENUE_TYPE,
              { item_key: venue.id, item_label: venue.name },
              followed,
            );
          }}
        />
      ) : null}

      {mode === "following" ? (
        <>
          <FollowedRoster
            title="Artists you follow"
            empty="No artists yet. Search by name and tap Follow."
            items={follows.artists}
            itemType={FOLLOWED_ATTRACTION_TYPE}
            isPending={follows.isPending}
            itemError={follows.itemError}
            onRemove={(item) => removeFollow(FOLLOWED_ATTRACTION_TYPE, item)}
          />
          <FollowedRoster
            title="Venues you follow"
            empty="No venues yet. Search by name, and add a city if you want a tighter list."
            items={follows.venues}
            itemType={FOLLOWED_VENUE_TYPE}
            isPending={follows.isPending}
            itemError={follows.itemError}
            onRemove={(item) => removeFollow(FOLLOWED_VENUE_TYPE, item)}
          />
        </>
      ) : null}
    </Screen>
  );
}

function ModeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.mode, selected && styles.modeSelected]}
    >
      <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ArtistSearch({
  inputRef,
  keyword,
  onChangeKeyword,
  state,
  onSearch,
  follows,
  onOpen,
  onToggle,
}: {
  inputRef: RefObject<TextInput | null>;
  keyword: string;
  onChangeKeyword: (value: string) => void;
  state: ArtistSearchState;
  onSearch: () => void;
  follows: ReturnType<typeof useFollows>;
  onOpen: (artist: TicketmasterAttraction) => void;
  onToggle: (artist: TicketmasterAttraction, followed: boolean) => void;
}) {
  return (
    <>
      <View style={styles.search}>
        <Strong>Search artists</Strong>
        <TextInput
          ref={inputRef}
          value={keyword}
          onChangeText={onChangeKeyword}
          placeholder="Artist name, like Wilco"
          placeholderTextColor={colors.mute}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit
          accessibilityLabel="Artist name"
          onSubmitEditing={onSearch}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search artists"
          onPress={onSearch}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Search artists</Text>
        </Pressable>
      </View>

      {state.status === "idle" ? (
        <EmptyState
          title="Search for an artist"
          body="Results come from Ticketmaster. Tap Follow to add one."
        />
      ) : null}

      {state.status === "loading" ? (
        <LoadingBlock label="Searching artists…" />
      ) : null}

      {state.status === "error" ? (
        <EmptyState
          title="Search didn’t finish"
          body={state.message}
          action={<Button label="Try again" onPress={onSearch} />}
        />
      ) : null}

      {state.status === "ready" && state.attractions.length === 0 ? (
        <EmptyState
          title="No artists found"
          body="Try a different name. Ticketmaster has to list that artist."
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
                  onPress={() => onOpen(artist)}
                  trailing={
                    <SearchFollowButton
                      name={artist.name}
                      followed={followed}
                      busy={follows.isPending(
                        FOLLOWED_ATTRACTION_TYPE,
                        artist.id,
                      )}
                      onToggle={() => onToggle(artist, followed)}
                    />
                  }
                />
                {rowError ? <Body style={styles.rowError}>{rowError}</Body> : null}
              </View>
            );
          })}
        </ScreenBlock>
      ) : null}
    </>
  );
}

function VenueSearch({
  inputRef,
  keyword,
  city,
  onChangeKeyword,
  onChangeCity,
  state,
  onSearch,
  follows,
  onOpen,
  onToggle,
}: {
  inputRef: RefObject<TextInput | null>;
  keyword: string;
  city: string;
  onChangeKeyword: (value: string) => void;
  onChangeCity: (value: string) => void;
  state: VenueSearchState;
  onSearch: () => void;
  follows: ReturnType<typeof useFollows>;
  onOpen: (venue: TicketmasterVenue) => void;
  onToggle: (venue: TicketmasterVenue, followed: boolean) => void;
}) {
  return (
    <>
      <View style={styles.search}>
        <Strong>Search venues</Strong>
        <TextInput
          ref={inputRef}
          value={keyword}
          onChangeText={onChangeKeyword}
          placeholder="Venue name, like The NorVa"
          placeholderTextColor={colors.mute}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="next"
          blurOnSubmit={false}
          accessibilityLabel="Venue name"
          style={styles.input}
        />
        <TextInput
          value={city}
          onChangeText={onChangeCity}
          placeholder="City (optional), like Norfolk"
          placeholderTextColor={colors.mute}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit
          accessibilityLabel="Venue city"
          onSubmitEditing={onSearch}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search venues"
          onPress={onSearch}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Search venues</Text>
        </Pressable>
      </View>

      {state.status === "idle" ? (
        <EmptyState
          title="Search for a venue"
          body="Add a city when the name is common, like The Fillmore. Ticketmaster supplies the list."
        />
      ) : null}

      {state.status === "loading" ? (
        <LoadingBlock label="Searching venues…" />
      ) : null}

      {state.status === "error" ? (
        <EmptyState
          title="Search didn’t finish"
          body={state.message}
          action={<Button label="Try again" onPress={onSearch} />}
        />
      ) : null}

      {state.status === "ready" && state.venues.length === 0 ? (
        <EmptyState
          title="No venues found"
          body={
            state.city
              ? `No Ticketmaster venues matched that name in ${state.city}. Try the city name Ticketmaster uses, or leave the city blank.`
              : "Try a different venue name."
          }
        />
      ) : null}

      {state.status === "ready" && state.venues.length > 0 ? (
        <ScreenBlock>
          <Strong>Venues</Strong>
          {state.venues.map((venue) => {
            const followed = follows.isFollowed(FOLLOWED_VENUE_TYPE, venue.id);
            const place = venueSubtitle(venue);
            const rowError = follows.itemError(FOLLOWED_VENUE_TYPE, venue.id);
            return (
              <View key={venue.id} style={styles.result}>
                <ListRow
                  title={venue.name}
                  subtitle={place}
                  accessibilityLabel={`View upcoming shows at ${venue.name}`}
                  onPress={() => onOpen(venue)}
                  trailing={
                    <SearchFollowButton
                      name={venue.name}
                      followed={followed}
                      busy={follows.isPending(FOLLOWED_VENUE_TYPE, venue.id)}
                      onToggle={() => onToggle(venue, followed)}
                    />
                  }
                />
                {rowError ? <Body style={styles.rowError}>{rowError}</Body> : null}
              </View>
            );
          })}
        </ScreenBlock>
      ) : null}
    </>
  );
}

function SearchFollowButton({
  name,
  followed,
  busy,
  onToggle,
}: {
  name: string;
  followed: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (followed && confirming) {
    return (
      <View style={styles.confirmFollow}>
        <Button
          label="Remove"
          variant="danger"
          busy={busy}
          disabled={busy}
          accessibilityLabel={`Confirm remove ${name}`}
          onPress={() => {
            setConfirming(false);
            onToggle();
          }}
        />
        <Button
          label="Keep"
          variant="secondary"
          disabled={busy}
          accessibilityLabel={`Keep following ${name}`}
          onPress={() => setConfirming(false)}
        />
      </View>
    );
  }

  return (
    <Button
      label={followed ? "Following" : "Follow"}
      variant={followed ? "secondary" : "action"}
      busy={busy}
      accessibilityLabel={followed ? `Remove ${name}` : `Follow ${name}`}
      onPress={() => {
        if (followed) {
          setConfirming(true);
          return;
        }
        onToggle();
      }}
    />
  );
}

const styles = StyleSheet.create({
  modes: {
    flexDirection: "row",
    gap: 8,
  },
  mode: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
  },
  modeSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  modeLabel: {
    color: colors.foreground,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  modeLabelSelected: {
    color: colors.onAccent,
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
  confirmFollow: {
    gap: 8,
  },
  rowError: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    paddingHorizontal: 4,
  },
});
