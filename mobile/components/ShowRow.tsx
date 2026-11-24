import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { useFollows } from "@/hooks/useFollows";
import { useHomeLocation } from "@/hooks/useHomeLocation";
import type { TicketmasterShow } from "@/lib/api";
import { showDistanceLabel } from "@/lib/geo";
import { activeOrigin } from "@/lib/home-location";
import { FOLLOWED_ATTRACTION_TYPE } from "@/lib/follows";
import { showSubtitle } from "@/lib/show-format";
import { cardFollowArtist } from "@/lib/show-follow";

import { FollowToggleButton } from "./FollowToggleButton";
import { ListRow } from "./ListRow";
import { Body } from "./Typography";
import { colors } from "@/constants/theme";

function withDistance(subtitle: string, label: string | null) {
  if (!label) {
    return subtitle;
  }
  const parts = subtitle.split(" · ").map((part) => part.trim());
  if (parts.includes(label)) {
    return subtitle;
  }
  return subtitle ? `${subtitle} · ${label}` : label;
}

export function ShowRow({
  show,
  trailing,
  kicker,
  subtitle,
  badge,
  onOpen,
  followArtistId,
  showFollow = true,
}: {
  show: TicketmasterShow;
  trailing?: ReactNode;
  kicker?: string;
  subtitle?: string;
  badge?: string | null;
  onOpen?: () => void;
  followArtistId?: string | null;
  showFollow?: boolean;
}) {
  const router = useRouter();
  const follows = useFollows();
  const home = useHomeLocation();
  const origin = activeOrigin(home.location);
  const distance = showDistanceLabel(show, origin);
  const resolvedSubtitle = withDistance(subtitle ?? showSubtitle(show), distance);
  const badgeLabel = badge?.trim() ?? "";
  const artist = showFollow
    ? cardFollowArtist(
        show.attractions,
        follows.artists.map((item) => item.item_key),
        followArtistId,
      )
    : null;
  const artistFollowed = artist
    ? follows.isFollowed(FOLLOWED_ATTRACTION_TYPE, artist.id)
    : false;
  const artistError = artist
    ? follows.itemError(FOLLOWED_ATTRACTION_TYPE, artist.id)
    : null;

  return (
    <View style={styles.block}>
      <ListRow
        title={show.name}
        kicker={kicker}
        subtitle={resolvedSubtitle}
        badge={badgeLabel || undefined}
        accessibilityLabel={`${badgeLabel ? `${badgeLabel}. ` : ""}${kicker ? `${kicker}. ` : ""}${show.name}. ${resolvedSubtitle}`}
        onPress={() => {
          onOpen?.();
          router.push({
            pathname: "/concert/[id]",
            params: {
              id: show.id,
              name: show.name,
              dateLabel: show.dateLabel,
              timeLabel: show.timeLabel ?? "",
              localDate: show.localDate ?? "",
              localTime: show.localTime ?? "",
              startsAt: show.startsAt ?? "",
              timezone: show.timezone ?? "",
              doorTime: show.doorTime ?? "",
              venueName: show.venueName,
              venueAddress: show.venueAddress ?? "",
              city: show.city,
              state: show.state,
              url: show.url ?? "",
              image: show.image ?? "",
            },
          });
        }}
        trailing={
          <View style={styles.actions}>
            {artist ? (
              <FollowToggleButton
                name={artist.name}
                followed={artistFollowed}
                busy={follows.isPending(FOLLOWED_ATTRACTION_TYPE, artist.id)}
                onToggle={() => {
                  void follows.toggleFollow(
                    FOLLOWED_ATTRACTION_TYPE,
                    { item_key: artist.id, item_label: artist.name },
                    artistFollowed,
                  );
                }}
              />
            ) : null}
            {trailing}
          </View>
        }
      />
      {artistError ? <Body style={styles.error}>{artistError}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  actions: {
    alignItems: "flex-end",
    gap: 8,
    flexShrink: 0,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },
});
