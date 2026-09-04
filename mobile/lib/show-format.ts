import type { TicketmasterShow } from "./api";

export function showPlace(show: Pick<TicketmasterShow, "city" | "state">) {
  return [show.city, show.state].filter(Boolean).join(", ");
}

export function showWhen(show: Pick<TicketmasterShow, "dateLabel" | "timeLabel">) {
  return show.timeLabel
    ? `${show.dateLabel} · ${show.timeLabel}`
    : show.dateLabel;
}

export function showVenueLine(
  show: Pick<TicketmasterShow, "venueName" | "city" | "state">,
) {
  const place = showPlace(show);
  return [show.venueName, place].filter(Boolean).join(" · ");
}

export function showSubtitle(show: TicketmasterShow) {
  return [showWhen(show), showVenueLine(show)].filter(Boolean).join(" · ");
}
