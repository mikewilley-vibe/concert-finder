import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { colors } from "@/constants/theme";
import { useFollows } from "@/hooks/useFollows";
import { useHomeLocation } from "@/hooks/useHomeLocation";
import { apiErrorMessage, searchUpcomingShows } from "@/lib/api";
import {
  initialFavoriteShowCursors,
  loadFavoriteShowPage,
} from "@/lib/favorite-show-pages";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  type FollowedItem,
  type FollowedItemType,
} from "@/lib/follows";
import { venueFollowDetails } from "@/lib/follow-management";
import { activeOrigin, activePlaceLabel } from "@/lib/home-location";

export default function ManageFollowsScreen() {
  const follows = useFollows();
  const home = useHomeLocation();
  const [venueShows, setVenueShows] = useState<Awaited<
    ReturnType<typeof searchUpcomingShows>
  >["shows"]>([]);
  const [venueDetailsError, setVenueDetailsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!follows.ready || follows.venues.length === 0) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void loadFavoriteShowPage({
        kind: "venue",
        cursors: initialFavoriteShowCursors("venue", follows.venues),
        search: searchUpcomingShows,
      })
        .then((result) => {
          if (!cancelled) {
            setVenueShows(result.shows);
            setVenueDetailsError(null);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setVenueDetailsError(
              apiErrorMessage(error, "Some venue locations are unavailable."),
            );
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [follows.ready, follows.venues]);

  const origin = activeOrigin(home.location);
  const venueDetails = useMemo(
    () => venueFollowDetails(follows.venues, venueShows, origin),
    [follows.venues, origin, venueShows],
  );
  const place = activePlaceLabel(home.location);

  function confirmRemove(itemType: FollowedItemType, item: FollowedItem) {
    const noun =
      itemType === FOLLOWED_ATTRACTION_TYPE ? "artist" : "venue";
    Alert.alert(
      `Unfollow ${item.item_label}?`,
      `ShowSignal will stop monitoring this ${noun} for new shows.`,
      [
        { text: "Keep following", style: "cancel" },
        {
          text: "Unfollow",
          style: "destructive",
          onPress: () => {
            void follows.toggleFollow(itemType, item, true).then((result) => {
              if (result.ok) {
                setNotice(`Stopped following ${item.item_label}.`);
              }
            });
          },
        },
      ],
    );
  }

  if (!follows.ready) {
    return (
      <Screen>
        <LoadingBlock label="Loading your artists and venues…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Your favorites</Eyebrow>
        <Title>Manage artists & venues</Title>
        <Body>
          Review everything you follow and remove anything you no longer want
          ShowSignal to monitor.
        </Body>
        {notice ? <Body accessibilityLiveRegion="polite">{notice}</Body> : null}
        {follows.error ? <Body>{follows.error}</Body> : null}
      </ScreenBlock>

      <FollowSection
        title="My artists"
        empty="You aren’t following any artists yet."
        items={follows.artists}
        itemType={FOLLOWED_ATTRACTION_TYPE}
        isPending={follows.isPending}
        onRemove={confirmRemove}
      />

      <FollowSection
        title="My venues"
        empty="You aren’t following any venues yet."
        items={follows.venues}
        itemType={FOLLOWED_VENUE_TYPE}
        isPending={follows.isPending}
        onRemove={confirmRemove}
        detailFor={(item) => {
          const detail = venueDetails.get(item.item_key);
          if (!detail) return "Location unavailable";
          return [detail.place, detail.distanceLabel]
            .filter(Boolean)
            .join(" · ");
        }}
      />

      {follows.venues.length > 0 ? (
        <ScreenBlock>
          <Body>
            {origin
              ? `Distances are measured from ${place || "your selected location"}.`
              : "Add a coordinate-based home or current location to see approximate venue distances."}
          </Body>
          {venueDetailsError ? <Body>{venueDetailsError}</Body> : null}
        </ScreenBlock>
      ) : null}
    </Screen>
  );
}

function FollowSection({
  title,
  empty,
  items,
  itemType,
  detailFor,
  isPending,
  onRemove,
}: {
  title: string;
  empty: string;
  items: readonly FollowedItem[];
  itemType: FollowedItemType;
  detailFor?: (item: FollowedItem) => string;
  isPending: (itemType: FollowedItemType, itemKey: string) => boolean;
  onRemove: (itemType: FollowedItemType, item: FollowedItem) => void;
}) {
  return (
    <ScreenBlock>
      <Strong>{title} · {items.length}</Strong>
      {items.length === 0 ? (
        <EmptyState
          title={
            itemType === FOLLOWED_ATTRACTION_TYPE
              ? "No followed artists"
              : "No followed venues"
          }
          body={empty}
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            const pending = isPending(itemType, item.item_key);
            return (
              <View key={item.item_key} style={styles.row}>
                <View style={styles.copy}>
                  <Strong>{item.item_label}</Strong>
                  {detailFor ? <Body style={styles.detail}>{detailFor(item)}</Body> : null}
                </View>
                <Button
                  label={pending ? "Removing…" : "Unfollow"}
                  accessibilityLabel={`Unfollow ${item.item_label}`}
                  variant="danger"
                  disabled={pending}
                  busy={pending}
                  onPress={() => onRemove(itemType, item)}
                />
              </View>
            );
          })}
        </View>
      )}
    </ScreenBlock>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  row: {
    minHeight: 76,
    padding: 14,
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  detail: {
    fontSize: 14,
    lineHeight: 19,
  },
});
