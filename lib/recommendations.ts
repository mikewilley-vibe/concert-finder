import type {
  RecommendationsData,
  RelatedArtistSuggestion,
  RelatedVenueSuggestion,
} from "../shared/api/v1.ts";

export const MAX_RELATED_ARTISTS = 6;
export const MAX_RELATED_VENUES = 6;
export const MAX_RECOMMENDATION_SEEDS = 10;

export type RecommendationSeed = {
  id: string;
  label: string;
  genreId: string | null;
  genreName: string | null;
  subGenreId: string | null;
  subGenreName: string | null;
};

export type RelatedEventFact = {
  attractionId: string;
  attractionName: string;
  attractionGenreId: string | null;
  attractionSubGenreId: string | null;
  venueId: string;
  venueName: string;
  venueCity: string | null;
  venueState: string | null;
  startsAt: string | null;
  nearLocation: boolean;
};

export type ParsedRecommendationsRequest = {
  seed: RecommendationSeed | null;
  excludeAttractionIds: Set<string>;
  excludeVenueIds: Set<string>;
  location: {
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
    radiusMiles: number;
  };
};

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

function readIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    const id = typeof row === "string" ? row.trim() : "";
    if (!ID_PATTERN.test(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

function readSeed(value: unknown): RecommendationSeed | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as {
    id?: unknown;
    label?: unknown;
    genreId?: unknown;
    genreName?: unknown;
    subGenreId?: unknown;
    subGenreName?: unknown;
  };
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!ID_PATTERN.test(id) || !label) {
    return null;
  }
  const genreId =
    typeof record.genreId === "string" && record.genreId.trim()
      ? record.genreId.trim()
      : null;
  const subGenreId =
    typeof record.subGenreId === "string" && record.subGenreId.trim()
      ? record.subGenreId.trim()
      : null;
  const genreName =
    typeof record.genreName === "string" && record.genreName.trim()
      ? record.genreName.trim()
      : null;
  const subGenreName =
    typeof record.subGenreName === "string" && record.subGenreName.trim()
      ? record.subGenreName.trim()
      : null;
  if (!genreId && !subGenreId) {
    return null;
  }
  return {
    id,
    label,
    genreId,
    genreName,
    subGenreId,
    subGenreName,
  };
}

export function parseRecommendationsRequest(
  body: unknown,
): { ok: true; value: ParsedRecommendationsRequest } | { ok: false; status: number; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, status: 400, message: "Invalid recommendations request." };
  }
  const record = body as {
    seeds?: unknown;
    excludeAttractionIds?: unknown;
    excludeVenueIds?: unknown;
    location?: unknown;
  };
  const seeds = Array.isArray(record.seeds) ? record.seeds : [];
  let seed: RecommendationSeed | null = null;
  for (const row of seeds.slice(0, MAX_RECOMMENDATION_SEEDS)) {
    const parsed = readSeed(row);
    if (parsed) {
      seed = parsed;
      break;
    }
  }
  if (!seed) {
    return {
      ok: true,
      value: {
        seed: null,
        excludeAttractionIds: new Set(),
        excludeVenueIds: new Set(),
        location: {
          postalCode: "",
          latitude: null,
          longitude: null,
          radiusMiles: 50,
        },
      },
    };
  }

  const locationRecord =
    record.location && typeof record.location === "object"
      ? (record.location as {
          postalCode?: unknown;
          latitude?: unknown;
          longitude?: unknown;
          radiusMiles?: unknown;
        })
      : {};
  const postalCode =
    typeof locationRecord.postalCode === "string"
      ? locationRecord.postalCode.trim()
      : "";
  const latitude =
    typeof locationRecord.latitude === "number" &&
    Number.isFinite(locationRecord.latitude)
      ? locationRecord.latitude
      : null;
  const longitude =
    typeof locationRecord.longitude === "number" &&
    Number.isFinite(locationRecord.longitude)
      ? locationRecord.longitude
      : null;
  const radiusMiles =
    typeof locationRecord.radiusMiles === "number" &&
    Number.isInteger(locationRecord.radiusMiles) &&
    locationRecord.radiusMiles >= 1 &&
    locationRecord.radiusMiles <= 500
      ? locationRecord.radiusMiles
      : 50;

  return {
    ok: true,
    value: {
      seed,
      excludeAttractionIds: new Set(readIdList(record.excludeAttractionIds)),
      excludeVenueIds: new Set(readIdList(record.excludeVenueIds)),
      location: {
        postalCode,
        latitude: latitude !== null && longitude !== null ? latitude : null,
        longitude: latitude !== null && longitude !== null ? longitude : null,
        radiusMiles,
      },
    },
  };
}

function scoreArtist(
  eventCount: number,
  genreMatch: number,
  locationMatch: number,
  upcomingBoost: number,
) {
  return eventCount * 4 + genreMatch * 3 + locationMatch * 2 + upcomingBoost;
}

export function rankRelatedSuggestions(input: {
  seed: RecommendationSeed | null;
  excludeAttractionIds: Iterable<string>;
  excludeVenueIds: Iterable<string>;
  events: RelatedEventFact[];
}): RecommendationsData {
  if (!input.seed || (!input.seed.genreId && !input.seed.subGenreId)) {
    return { seedLabel: null, artists: [], venues: [] };
  }

  const excludedArtists = new Set(input.excludeAttractionIds);
  excludedArtists.add(input.seed.id);
  const excludedVenues = new Set(input.excludeVenueIds);

  const artists = new Map<
    string,
    {
      item: RelatedArtistSuggestion;
      eventCount: number;
      score: number;
    }
  >();
  const venues = new Map<
    string,
    {
      item: RelatedVenueSuggestion;
      eventCount: number;
      score: number;
    }
  >();

  for (const event of input.events) {
    const genreMatch =
      input.seed.subGenreId &&
      event.attractionSubGenreId === input.seed.subGenreId
        ? 2
        : input.seed.genreId && event.attractionGenreId === input.seed.genreId
          ? 1
          : 0;
    const locationMatch = event.nearLocation ? 1 : 0;
    const upcomingBoost = event.startsAt ? 1 : 0;
    const genreReason = input.seed.subGenreName || input.seed.genreName || "similar shows";

    if (
      event.attractionId &&
      event.attractionName &&
      !excludedArtists.has(event.attractionId)
    ) {
      const current = artists.get(event.attractionId);
      const eventCount = (current?.eventCount ?? 0) + 1;
      const score = scoreArtist(eventCount, genreMatch, locationMatch, upcomingBoost);
      if (!current || score >= current.score) {
        artists.set(event.attractionId, {
          eventCount,
          score,
          item: {
            id: event.attractionId,
            name: event.attractionName,
            imageUrl: null,
            reason: `Upcoming ${genreReason} dates`,
          },
        });
      } else {
        current.eventCount = eventCount;
        current.score = scoreArtist(
          eventCount,
          genreMatch,
          locationMatch,
          upcomingBoost,
        );
      }
    }

    if (event.venueId && event.venueName && !excludedVenues.has(event.venueId)) {
      const current = venues.get(event.venueId);
      const eventCount = (current?.eventCount ?? 0) + 1;
      const score = scoreArtist(eventCount, genreMatch, locationMatch, upcomingBoost);
      const place = [event.venueCity, event.venueState].filter(Boolean).join(", ");
      if (!current || score >= current.score) {
        venues.set(event.venueId, {
          eventCount,
          score,
          item: {
            id: event.venueId,
            name: event.venueName,
            city: event.venueCity,
            state: event.venueState,
            reason: place
              ? `Similar shows in ${place}`
              : "Venues hosting similar upcoming shows",
          },
        });
      } else {
        current.eventCount = eventCount;
        current.score = scoreArtist(
          eventCount,
          genreMatch,
          locationMatch,
          upcomingBoost,
        );
      }
    }
  }

  const rankedArtists = [...artists.values()]
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, MAX_RELATED_ARTISTS)
    .map((row) => row.item);
  const rankedVenues = [...venues.values()]
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, MAX_RELATED_VENUES)
    .map((row) => row.item);

  const seenArtist = new Set<string>();
  const seenVenue = new Set<string>();
  const uniqueArtists = rankedArtists.filter((row) => {
    if (seenArtist.has(row.id)) {
      return false;
    }
    seenArtist.add(row.id);
    return true;
  });
  const uniqueVenues = rankedVenues.filter((row) => {
    if (seenVenue.has(row.id)) {
      return false;
    }
    seenVenue.add(row.id);
    return true;
  });

  if (uniqueArtists.length === 0 && uniqueVenues.length === 0) {
    return { seedLabel: null, artists: [], venues: [] };
  }

  return {
    seedLabel: input.seed.label,
    artists: uniqueArtists,
    venues: uniqueVenues,
  };
}
