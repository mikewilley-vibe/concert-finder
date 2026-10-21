import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import type { TicketmasterShow } from "@/lib/api";
import { showSubtitle } from "@/lib/show-format";

import { ListRow } from "./ListRow";

export function ShowRow({
  show,
  trailing,
  kicker,
  subtitle,
  badge,
  onOpen,
}: {
  show: TicketmasterShow;
  trailing?: ReactNode;
  kicker?: string;
  subtitle?: string;
  badge?: string | null;
  onOpen?: () => void;
}) {
  const router = useRouter();
  const resolvedSubtitle = subtitle ?? showSubtitle(show);
  const badgeLabel = badge?.trim() ?? "";

  return (
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
      trailing={trailing}
    />
  );
}
