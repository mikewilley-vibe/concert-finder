import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import type { TicketmasterShow } from "@/lib/api";
import { showSubtitle } from "@/lib/show-format";

import { ListRow } from "./ListRow";

export function ShowRow({
  show,
  trailing,
}: {
  show: TicketmasterShow;
  trailing?: ReactNode;
}) {
  const router = useRouter();

  return (
    <ListRow
      title={show.matchedLabels[0] || show.name}
      subtitle={showSubtitle(show)}
      accessibilityLabel={`${show.name}. ${showSubtitle(show)}`}
      onPress={() =>
        router.push({
          pathname: "/concert/[id]",
          params: {
            id: show.id,
            name: show.name,
            dateLabel: show.dateLabel,
            timeLabel: show.timeLabel ?? "",
            venueName: show.venueName,
            city: show.city,
            state: show.state,
            url: show.url ?? "",
            image: show.image ?? "",
          },
        })
      }
      trailing={trailing}
    />
  );
}
