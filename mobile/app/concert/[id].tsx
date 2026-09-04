import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Linking, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { colors } from "@/constants/theme";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import {
  apiErrorMessage,
  getEventDetails,
  type TicketmasterShow,
} from "@/lib/api";
import { showPlace, showWhen } from "@/lib/show-format";

function firstString(value: string | string[] | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function showFromParams(params: {
  id?: string;
  name?: string;
  dateLabel?: string;
  timeLabel?: string;
  venueName?: string;
  city?: string;
  state?: string;
  url?: string;
  image?: string;
}): TicketmasterShow | null {
  const id = firstString(params.id);
  const name = firstString(params.name);
  if (!id || !name || id === "preview") {
    return null;
  }

  const show: TicketmasterShow = {
    id,
    name,
    dateLabel: firstString(params.dateLabel) ?? "Date TBA",
    venueName: firstString(params.venueName) ?? "",
    city: firstString(params.city) ?? "",
    state: firstString(params.state) ?? "",
    matchedLabels: [],
  };
  const timeLabel = firstString(params.timeLabel);
  const url = firstString(params.url);
  const image = firstString(params.image);
  if (timeLabel) show.timeLabel = timeLabel;
  if (url) show.url = url;
  if (image) show.image = image;
  return show;
}

export default function ConcertScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    dateLabel?: string;
    timeLabel?: string;
    venueName?: string;
    city?: string;
    state?: string;
    url?: string;
    image?: string;
  }>();
  const eventId = firstString(params.id);
  const snapshot = useMemo(
    () =>
      showFromParams({
        id: eventId,
        name: firstString(params.name),
        dateLabel: firstString(params.dateLabel),
        timeLabel: firstString(params.timeLabel),
        venueName: firstString(params.venueName),
        city: firstString(params.city),
        state: firstString(params.state),
        url: firstString(params.url),
        image: firstString(params.image),
      }),
    [
      eventId,
      params.name,
      params.dateLabel,
      params.timeLabel,
      params.venueName,
      params.city,
      params.state,
      params.url,
      params.image,
    ],
  );
  const saved = useSavedEvents();
  const [show, setShow] = useState<TicketmasterShow | null>(snapshot);
  const [loading, setLoading] = useState(eventId !== "preview");
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    if (!eventId || eventId === "preview") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getEventDetails([eventId]);
      const next = result.shows[0];
      if (next) {
        setShow(next);
      } else if (!snapshot) {
        setError("That concert could not be found.");
      }
    } catch (loadError) {
      if (!snapshot) {
        setError(
          apiErrorMessage(loadError, "Could not load this concert. Try again."),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [eventId, snapshot]);

  useEffect(() => {
    setShow(snapshot);
    void loadDetails();
  }, [eventId, loadDetails, snapshot]);

  if (eventId === "preview") {
    return (
      <Screen>
        <ScreenBlock>
          <Eyebrow>Concert</Eyebrow>
          <Title>Concert detail</Title>
          <Body>
            Open a real show from Discover, Home, or Saved to see artwork,
            date, venue, and a Ticketmaster link.
          </Body>
        </ScreenBlock>
      </Screen>
    );
  }

  const place = show ? showPlace(show) : "";
  const when = show ? showWhen(show) : "";
  const isSaved = show ? saved.savedIds.has(show.id) : false;

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Concert</Eyebrow>
        <Title>{show?.name ?? "Show details"}</Title>
        <Body>
          Artwork, date, venue, and Ticketmaster links come from the website
          API. Saves use live Phase 1 columns only.
        </Body>
      </ScreenBlock>

      {show?.image ? (
        <Image
          source={{ uri: show.image }}
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${show.name} artwork`}
          style={styles.art}
        />
      ) : null}

      {loading ? <LoadingBlock label="Loading concert details…" /> : null}

      {error ? (
        <EmptyState
          title="Concert didn’t load"
          body={error}
          action={
            <Button
              label="Try again"
              onPress={() => {
                void loadDetails();
              }}
            />
          }
        />
      ) : null}

      {show ? (
        <View style={styles.card}>
          <Strong>{when || "Date TBA"}</Strong>
          {show.venueName ? <Body>{show.venueName}</Body> : null}
          {place ? <Body>{place}</Body> : null}
          <Body>
            {show.dateLabel === "Date TBA"
              ? "Status: date to be announced"
              : "Status: scheduled"}
          </Body>
          {saved.error ? <Body>{saved.error}</Body> : null}
          {saved.configured ? (
            <Button
              label={isSaved ? "Saved" : "Save show"}
              variant={isSaved ? "secondary" : "primary"}
              disabled={!saved.ready || saved.isPending(show.id)}
              accessibilityLabel={
                isSaved
                  ? `Remove ${show.name} from saved`
                  : `Save ${show.name}`
              }
              onPress={() => {
                void saved.toggleSaved(show);
              }}
            />
          ) : (
            <Body>
              Add the public Supabase values to save concerts from this screen.
            </Body>
          )}
          {show.url ? (
            <Button
              label="View on Ticketmaster"
              variant="secondary"
              accessibilityLabel={`View ${show.name} on Ticketmaster`}
              onPress={() => {
                void Linking.openURL(show.url!);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  art: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: colors.panel,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
});
