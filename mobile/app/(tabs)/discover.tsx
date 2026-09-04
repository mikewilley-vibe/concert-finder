import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { colors, fonts } from "@/constants/theme";
import {
  ApiError,
  searchAttractions,
  searchVenues,
  type TicketmasterAttraction,
  type TicketmasterVenue,
} from "@/lib/api";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      attractions: TicketmasterAttraction[];
      venues: TicketmasterVenue[];
    };

export default function DiscoverScreen() {
  const router = useRouter();
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
      setState({
        status: "ready",
        attractions: attractionsResult.attractions,
        venues: venuesResult.venues,
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof ApiError
            ? error.message
            : "Could not reach the concert API. Try again.",
      });
    }
  }

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Discover</Eyebrow>
        <Title>Search artists, venues, and upcoming shows.</Title>
        <Body>
          Search talks to the Concert Finder website API, not Ticketmaster
          from this device. Community concert submission stays on the website.
        </Body>
      </ScreenBlock>

      <View style={styles.search}>
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

      {state.status === "idle" ? (
        <EmptyState
          title="Search to get started"
          body="Results open artist, venue, and concert screens on the stack. Upcoming-show lists for a follow come in a later pass."
        />
      ) : null}

      {state.status === "loading" ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Body>Searching the website API…</Body>
        </View>
      ) : null}

      {state.status === "error" ? (
        <EmptyState title="Search didn’t finish" body={state.message} />
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
          {state.attractions.map((artist) => (
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
            />
          ))}
        </ScreenBlock>
      ) : null}

      {state.status === "ready" && state.venues.length > 0 ? (
        <ScreenBlock>
          <Strong>Venues</Strong>
          {state.venues.map((venue) => (
            <ListRow
              key={venue.id}
              title={venue.name}
              subtitle={[venue.city, venue.state].filter(Boolean).join(", ")}
              onPress={() =>
                router.push({
                  pathname: "/venue/[id]",
                  params: { id: venue.id, name: venue.name },
                })
              }
            />
          ))}
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
    color: colors.foreground,
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
    color: colors.background,
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
