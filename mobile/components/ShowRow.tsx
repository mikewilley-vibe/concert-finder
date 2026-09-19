import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { colors, fonts } from "@/constants/theme";
import type { TicketmasterShow } from "@/lib/api";
import {
  eventSourceName,
  eventStatusPresentation,
} from "@/lib/event-metadata";
import { showSubtitle } from "@/lib/show-format";

import { ListRow } from "./ListRow";

export function ShowRow({
  show,
  trailing,
  kicker,
  subtitle,
  onOpen,
}: {
  show: TicketmasterShow;
  trailing?: ReactNode;
  kicker?: string;
  subtitle?: string;
  onOpen?: () => void;
}) {
  const router = useRouter();
  const status = eventStatusPresentation(show);
  const source = eventSourceName(show);
  const resolvedSubtitle = [subtitle ?? showSubtitle(show), source]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.container}>
      {status?.disrupted ? (
        <View
          accessibilityRole="alert"
          style={styles.statusBanner}
        >
          <Text style={styles.statusLabel}>{status.label}</Text>
          <Text style={styles.statusCopy}>Check the official listing before making plans.</Text>
        </View>
      ) : null}
      <ListRow
        title={show.name}
        kicker={kicker}
        subtitle={resolvedSubtitle}
        accessibilityLabel={`${status?.disrupted ? `${status.label}. ` : ""}${kicker ? `${kicker}. ` : ""}${show.name}. ${resolvedSubtitle}`}
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
              status: show.status ?? "",
              statusLabel: show.statusLabel ?? "",
              sourceName: show.sourceName ?? "",
              sourceUpdatedAt: show.sourceUpdatedAt ?? "",
            },
          });
        }}
        trailing={trailing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  statusBanner: {
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "#2b1912",
  },
  statusLabel: {
    color: colors.danger,
    fontFamily: fonts.semibold,
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statusCopy: {
    color: colors.foreground,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
