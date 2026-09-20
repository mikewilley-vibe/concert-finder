import type { TicketmasterShow } from "./api.ts";
import type { FollowedItem } from "./follows.ts";
import { distanceMiles, formatDistanceMiles, type GeoPoint } from "./geo.ts";

export type VenueFollowDetail = {
  place: string;
  distanceLabel: string | null;
};

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesVenue(item: FollowedItem, show: TicketmasterShow) {
  if (show.venueId && show.venueId === item.item_key) {
    return true;
  }
  return normalizeName(show.venueName) === normalizeName(item.item_label);
}

export function venueFollowDetails(
  venues: readonly FollowedItem[],
  shows: readonly TicketmasterShow[],
  origin: GeoPoint | null,
) {
  const details = new Map<string, VenueFollowDetail>();
  for (const venue of venues) {
    const show = shows.find((candidate) => matchesVenue(venue, candidate));
    if (!show) continue;
    const place = [show.city, show.state].filter(Boolean).join(", ");
    const hasCoordinates =
      typeof show.venueLatitude === "number" &&
      typeof show.venueLongitude === "number";
    const distanceLabel =
      origin && hasCoordinates
        ? formatDistanceMiles(
            distanceMiles(origin, {
              latitude: show.venueLatitude as number,
              longitude: show.venueLongitude as number,
            }),
          )
        : null;
    details.set(venue.item_key, { place, distanceLabel });
  }
  return details;
}
