import type { TicketmasterShow } from "./api";

export type EventStatusPresentation = {
  label: string;
  disrupted: boolean;
};

export function eventStatusPresentation(
  show: Pick<TicketmasterShow, "status" | "statusLabel">,
): EventStatusPresentation | null {
  const status = show.status?.trim().toLowerCase();
  if (status === "canceled" || status === "cancelled") {
    return { label: "Canceled", disrupted: true };
  }
  if (status === "postponed") {
    return { label: "Postponed", disrupted: true };
  }
  if (status === "rescheduled") {
    return { label: "Rescheduled", disrupted: true };
  }
  const label = show.statusLabel?.trim();
  return label ? { label, disrupted: false } : null;
}

export function eventSourceName(
  show: Pick<TicketmasterShow, "sourceName">,
) {
  return show.sourceName?.trim() || "Ticketmaster";
}

export function eventSourceLine(
  show: Pick<TicketmasterShow, "sourceName" | "sourceUpdatedAt">,
  now = new Date(),
) {
  const source = eventSourceName(show);
  const stamp = show.sourceUpdatedAt?.trim();
  if (!stamp) {
    return `Source: ${source}`;
  }
  const updated = new Date(stamp);
  if (Number.isNaN(updated.getTime())) {
    return `Source: ${source}`;
  }
  const sameYear = updated.getFullYear() === now.getFullYear();
  const date = updated.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" as const }),
  });
  return `Source: ${source} · Updated ${date}`;
}
