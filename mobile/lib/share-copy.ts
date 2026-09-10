import type { TicketmasterShow } from "./api";

export const APP_SCHEME = "showsignal";

export function appDeepLink(path: string) {
  const trimmed = path.replace(/^\/+/, "");
  return `${APP_SCHEME}://${trimmed}`;
}

export function concertDeepLink(id: string) {
  return appDeepLink(`concert/${encodeURIComponent(id)}`);
}

export function artistDeepLink(id: string, name?: string) {
  const path = `artist/${encodeURIComponent(id)}`;
  if (!name?.trim()) {
    return appDeepLink(path);
  }
  return `${appDeepLink(path)}?name=${encodeURIComponent(name.trim())}`;
}

export function venueDeepLink(id: string, name?: string) {
  const path = `venue/${encodeURIComponent(id)}`;
  if (!name?.trim()) {
    return appDeepLink(path);
  }
  return `${appDeepLink(path)}?name=${encodeURIComponent(name.trim())}`;
}

export function openWebPath(
  kind: "concert" | "artist" | "venue",
  id: string,
  name?: string,
) {
  const path = `/open/${kind}/${encodeURIComponent(id)}`;
  if (!name?.trim()) {
    return path;
  }
  return `${path}?name=${encodeURIComponent(name.trim())}`;
}

export function absoluteUrl(origin: string, path: string) {
  return new URL(path, `${origin.replace(/\/$/, "")}/`).toString();
}

function shareWhen(show: Pick<TicketmasterShow, "dateLabel" | "timeLabel">) {
  return show.timeLabel
    ? `${show.dateLabel} · ${show.timeLabel}`
    : show.dateLabel;
}

function shareVenueLine(
  show: Pick<TicketmasterShow, "venueName" | "city" | "state">,
) {
  const place = [show.city, show.state].filter(Boolean).join(", ");
  return [show.venueName, place].filter(Boolean).join(" · ");
}

export function concertShareText(show: TicketmasterShow, websiteOrigin: string) {
  const lines = [
    show.name,
    shareWhen(show),
    shareVenueLine(show),
    absoluteUrl(websiteOrigin, openWebPath("concert", show.id, show.name)),
  ].filter((line) => line.trim().length > 0);
  return lines.join("\n");
}

export function listingShareText(
  kind: "artist" | "venue",
  name: string,
  id: string,
  websiteOrigin: string,
) {
  const label = name.trim() || (kind === "artist" ? "Artist" : "Venue");
  const link = absoluteUrl(
    websiteOrigin,
    openWebPath(kind, id, label),
  );
  return `${label} on ShowSignal\n${link}`;
}
