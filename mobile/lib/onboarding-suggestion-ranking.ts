import type { TicketmasterShow } from "./api.ts";
import {
  distanceMiles,
  formatDistanceMiles,
  type GeoPoint,
} from "./home-feed.ts";
import { showSortKey } from "./show-windows.ts";

export const ONBOARDING_VENUE_LIMIT = 12;
export const ONBOARDING_ARTIST_LIMIT = 16;

export type OnboardingSuggestion = {
  id: string;
  name: string;
  meta: string;
  showCount: number;
};

export type OnboardingSuggestions = {
  venues: OnboardingSuggestion[];
  artists: OnboardingSuggestion[];
};

type VenueCandidate = OnboardingSuggestion & {
  distanceMiles: number | null;
};

function showCountLabel(count: number) {
  return count === 1 ? "1 upcoming show" : `${count} upcoming shows`;
}

function venuePlace(show: TicketmasterShow) {
  return [show.city, show.state].filter(Boolean).join(", ");
}

function venueDistance(show: TicketmasterShow, origin: GeoPoint | null) {
  if (
    !origin ||
    typeof show.venueLatitude !== "number" ||
    typeof show.venueLongitude !== "number"
  ) {
    return null;
  }
  return distanceMiles(origin, {
    latitude: show.venueLatitude,
    longitude: show.venueLongitude,
  });
}

export function buildOnboardingSuggestions(
  shows: readonly TicketmasterShow[],
  origin: GeoPoint | null,
  input: { venueLimit?: number; artistLimit?: number } = {},
): OnboardingSuggestions {
  const venueLimit = input.venueLimit ?? ONBOARDING_VENUE_LIMIT;
  const artistLimit = input.artistLimit ?? ONBOARDING_ARTIST_LIMIT;
  const venues = new Map<
    string,
    VenueCandidate & { place: string; firstShow: string }
  >();
  const artists = new Map<
    string,
    OnboardingSuggestion & { firstShow: string }
  >();

  for (const show of shows) {
    const venueId = show.venueId?.trim();
    const venueName = show.venueName.trim();
    if (venueId && venueName) {
      const existing = venues.get(venueId);
      const distance = venueDistance(show, origin);
      const place = venuePlace(show);
      if (existing) {
        existing.showCount += 1;
        existing.firstShow = [existing.firstShow, showSortKey(show)].sort()[0];
        if (existing.distanceMiles === null && distance !== null) {
          existing.distanceMiles = distance;
        }
        if (!existing.place && place) {
          existing.place = place;
        }
      } else {
        venues.set(venueId, {
          id: venueId,
          name: venueName,
          meta: "",
          showCount: 1,
          distanceMiles: distance,
          place,
          firstShow: showSortKey(show),
        });
      }
    }

    for (const artist of show.attractions) {
      const artistId = artist.id.trim();
      const artistName = artist.name.trim();
      if (!artistId || !artistName) {
        continue;
      }
      const existing = artists.get(artistId);
      if (existing) {
        existing.showCount += 1;
        existing.firstShow = [existing.firstShow, showSortKey(show)].sort()[0];
      } else {
        artists.set(artistId, {
          id: artistId,
          name: artistName,
          meta: "Playing near you",
          showCount: 1,
          firstShow: showSortKey(show),
        });
      }
    }
  }

  const venueSuggestions = [...venues.values()]
    .sort((left, right) => {
      const leftDistance = left.distanceMiles ?? Number.POSITIVE_INFINITY;
      const rightDistance = right.distanceMiles ?? Number.POSITIVE_INFINITY;
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }
      if (right.showCount !== left.showCount) {
        return right.showCount - left.showCount;
      }
      const byDate = left.firstShow.localeCompare(right.firstShow);
      return byDate !== 0 ? byDate : left.name.localeCompare(right.name);
    })
    .slice(0, Math.max(0, venueLimit))
    .map((venue) => ({
      id: venue.id,
      name: venue.name,
      showCount: venue.showCount,
      meta:
        [
          venue.place,
          venue.distanceMiles === null
            ? ""
            : formatDistanceMiles(venue.distanceMiles),
        ]
          .filter(Boolean)
          .join(" · ") || showCountLabel(venue.showCount),
    }));

  const artistSuggestions = [...artists.values()]
    .sort((left, right) => {
      if (right.showCount !== left.showCount) {
        return right.showCount - left.showCount;
      }
      const byDate = left.firstShow.localeCompare(right.firstShow);
      return byDate !== 0 ? byDate : left.name.localeCompare(right.name);
    })
    .slice(0, Math.max(0, artistLimit))
    .map((artist) => ({
      id: artist.id,
      name: artist.name,
      showCount: artist.showCount,
      meta: showCountLabel(artist.showCount),
    }));

  return { venues: venueSuggestions, artists: artistSuggestions };
}
