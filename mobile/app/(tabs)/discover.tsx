import { useState } from "react";
import {
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
import {
  apiErrorMessage,
  searchAttractions,
  searchVenues,
  type TicketmasterAttraction,
  type TicketmasterVenue,
} from "@/lib/api";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
} from "@/lib/follows";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      attractions: TicketmasterAttraction[];
      venues: TicketmasterVenue[];
    };

function venueSubtitle(venue: TicketmasterVenue) {
  return [venue.city, venue.state].filter(Boolean).join(", ") || "Venue";
}

export default function DiscoverScreen() {
  const router = useRouter();
  const follows = useFollows();
  const [keyword, setKeyword] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function onSearch() {
    const query = keyword.trim();
    if (query.length < 2) {
      setState({
        status: "error",
        message: "Type at least two characters to search.",
      });
      return;
    }

    setState({ status: "loading" });

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
          "Could not reach the concert API. Try again.",
        ),
      });
    }
  }

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Discover</Eyebrow>
        <Title>Search artists, venues, and upcoming shows.</Title>
        <Body>
          Search for an artist or venue, then tap the bright Follow button.
          Upcoming concerts will appear on Home, where you can open and save
          them.
        </Body>
      </ScreenBlock>

      <View style={styles.search}>
        <Strong>Search artists and venues</Strong>
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Artist or venue name"
          placeholderTextColor={colors.mute}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
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

      {follows.error ? (
        <EmptyState title="Follows didn’t load" body={follows.error} />
      ) : null}

      {state.status === "idle" ? (
        <EmptyState
          title="Search to get started"
          body="Open an artist or venue to follow it and load upcoming Ticketmaster dates."
        />
      ) : null}

      {state.status === "loading" ? (
        <LoadingBlock label="Searching the website API…" />
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
          body="Try a different artist or venue name. Ticketmaster results are limited to the first page from the website API."
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
            return (
              <ListRow
                key={artist.id}
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
                    variant={followed ? "secondary" : "primary"}
                    disabled={
                      !follows.configured ||
                      !follows.ready ||
                      follows.isPending(FOLLOWED_ATTRACTION_TYPE, artist.id)
                    }
                    accessibilityLabel={
                      followed
                        ? `Unfollow ${artist.name}`
                        : `Follow ${artist.name}`
                    }
                    onPress={() => {
                      void follows.toggleFollow(
                        FOLLOWED_ATTRACTION_TYPE,
                        { item_key: artist.id, item_label: artist.name },
                        followed,
                      );
                    }}
                  />
                }
              />
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
            return (
              <ListRow
                key={venue.id}
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
                    variant={followed ? "secondary" : "primary"}
                    disabled={
                      !follows.configured ||
                      !follows.ready ||
                      follows.isPending(FOLLOWED_VENUE_TYPE, venue.id)
                    }
                    accessibilityLabel={
                      followed
                        ? `Unfollow ${venue.name}`
                        : `Follow ${venue.name}`
                    }
                    onPress={() => {
                      void follows.toggleFollow(
                        FOLLOWED_VENUE_TYPE,
                        { item_key: venue.id, item_label: venue.name },
                        followed,
                      );
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
});
