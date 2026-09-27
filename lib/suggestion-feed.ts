import {
  DEFAULT_SEARCH_RADIUS_MILES,
  searchUpcomingShows,
  type TicketmasterShow,
} from "./ticketmaster.ts";
import { isWithinRadius, resolveSearchOrigin } from "./geo.ts";
import {
  getSimilarArtists,
  type LastFmSimilarResult,
} from "./lastfm.ts";
import {
  buildSuggestionPills,
  type SuggestionActivity,
  type SuggestionFollow,
  type SuggestionShowFact,
  type SuggestionSignal,
} from "./suggestion-pills.ts";

const WINDOW_DAYS = 45;
const SEED_LIMIT = 6;
const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;
const SIGNALS = new Set<SuggestionSignal>([
  "opened",
  "saved",
  "interested",
  "going",
]);

export type SuggestionLocation = {
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  radiusMiles: number;
};

export type LastFmStatus = "ok" | "skipped" | "error";

type ShowSort = "date,asc" | "distance,asc";

type ShowLoader = (input: {
  attractions: SuggestionFollow[];
  location: SuggestionLocation;
  endDateTime: string;
  sort?: ShowSort;
}) => Promise<SuggestionShowFact[]>;

function toFact(show: TicketmasterShow): SuggestionShowFact {
  return {
    id: show.id,
    localDate: show.localDate,
    city: show.venue.city,
    state: show.venue.state,
    venueId: show.venue.id.trim() || null,
    venueName: show.venue.name.trim() || null,
    latitude: show.venue.latitude,
    longitude: show.venue.longitude,
    attractions: show.attractions.flatMap((artist) => {
      const id = artist.id.trim();
      const name = artist.name.trim();
      if (!id || !name) {
        return [];
      }
      return [{ id, name, imageUrl: artist.imageUrl }];
    }),
  };
}

async function loadTicketmasterShows(input: {
  attractions: SuggestionFollow[];
  location: SuggestionLocation;
  endDateTime: string;
  sort?: ShowSort;
}) {
  const result = await searchUpcomingShows({
    sort: input.sort,
    attractions: input.attractions.map((artist) => ({
      id: artist.id,
      label: artist.name,
    })),
    venues: [],
    keyword: "",
    location: {
      postalCode: input.location.postalCode,
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      radiusMiles: input.location.radiusMiles,
    },
    endDateTime: input.endDateTime,
    page: 0,
    pageSize: 50,
  });
  if (!result.ok) {
    return [];
  }
  return result.shows.map(toFact);
}

function hasLocation(location: SuggestionLocation) {
  return Boolean(location.postalCode) || location.latitude !== null;
}

function dedupeShows(shows: SuggestionShowFact[]) {
  const seen = new Set<string>();
  const unique: SuggestionShowFact[] = [];
  for (const show of shows) {
    if (!show.id || seen.has(show.id)) {
      continue;
    }
    seen.add(show.id);
    unique.push(show);
  }
  return unique;
}

function windowEnd(now: Date) {
  return new Date(now.getTime() + WINDOW_DAYS * 86_400_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
}

function readSignal(value: unknown): SuggestionSignal | null {
  return typeof value === "string" && SIGNALS.has(value as SuggestionSignal)
    ? (value as SuggestionSignal)
    : null;
}

function readActivity(value: unknown): SuggestionActivity[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: SuggestionActivity[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || rows.length >= 40) {
      continue;
    }
    const record = row as { id?: unknown; name?: unknown; signal?: unknown };
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const signal = readSignal(record.signal);
    if (!ID_PATTERN.test(id) || !signal) {
      continue;
    }
    const name = typeof record.name === "string" ? record.name.trim() : "";
    rows.push({ id, name: name.slice(0, 120), signal });
  }
  return rows;
}

export function parseSuggestionRequest(body: unknown) {
  if (body === undefined || body === null) {
    return {
      ok: true as const,
      location: null,
      openedArtists: [] as SuggestionActivity[],
      openedVenues: [] as SuggestionActivity[],
    };
  }
  if (typeof body !== "object") {
    return {
      ok: false as const,
      status: 400,
      message: "Invalid suggestions request.",
    };
  }

  const record = body as {
    location?: unknown;
    openedArtists?: unknown;
    openedVenues?: unknown;
  };
  let location: SuggestionLocation | null = null;
  if (record.location !== undefined && record.location !== null) {
    if (typeof record.location !== "object") {
      return {
        ok: false as const,
        status: 400,
        message: "Invalid suggestions request.",
      };
    }
    const place = record.location as {
      postalCode?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      radiusMiles?: unknown;
    };
    const postalCode =
      typeof place.postalCode === "string"
        ? place.postalCode.trim().toUpperCase()
        : "";
    if (postalCode && !/^[A-Z0-9][A-Z0-9\s-]{1,11}$/.test(postalCode)) {
      return {
        ok: false as const,
        status: 400,
        message: "Invalid suggestions request.",
      };
    }
    const hasLatitude = place.latitude !== undefined && place.latitude !== null;
    const hasLongitude = place.longitude !== undefined && place.longitude !== null;
    if (hasLatitude !== hasLongitude) {
      return {
        ok: false as const,
        status: 400,
        message: "Invalid suggestions request.",
      };
    }
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (hasLatitude && hasLongitude) {
      if (
        typeof place.latitude !== "number" ||
        typeof place.longitude !== "number" ||
        !Number.isFinite(place.latitude) ||
        !Number.isFinite(place.longitude) ||
        place.latitude < -90 ||
        place.latitude > 90 ||
        place.longitude < -180 ||
        place.longitude > 180
      ) {
        return {
          ok: false as const,
          status: 400,
          message: "Invalid suggestions request.",
        };
      }
      latitude = place.latitude;
      longitude = place.longitude;
    }
    let radiusMiles = DEFAULT_SEARCH_RADIUS_MILES;
    if (place.radiusMiles !== undefined && place.radiusMiles !== null) {
      if (
        typeof place.radiusMiles !== "number" ||
        !Number.isInteger(place.radiusMiles) ||
        place.radiusMiles < 1 ||
        place.radiusMiles > 500
      ) {
        return {
          ok: false as const,
          status: 400,
          message: "Invalid suggestions request.",
        };
      }
      radiusMiles = place.radiusMiles;
    }
    location = { postalCode, latitude, longitude, radiusMiles };
  }

  return {
    ok: true as const,
    location,
    openedArtists: readActivity(record.openedArtists),
    openedVenues: readActivity(record.openedVenues),
  };
}

export async function loadSuggestionPills(
  input: {
    follows: { artists: SuggestionFollow[]; venues: SuggestionFollow[] };
    dismissed: { artists: SuggestionFollow[]; venues: SuggestionFollow[] };
    activity: { artists: SuggestionActivity[]; venues: SuggestionActivity[] };
    savedShows: Array<SuggestionShowFact & {
      latitude: number | null;
      longitude: number | null;
    }>;
    location: SuggestionLocation | null;
    now?: Date;
  },
  deps?: {
    loadShows?: ShowLoader;
    similarArtists?: (name: string) => Promise<LastFmSimilarResult>;
  },
) {
  const empty = {
    artists: [],
    venues: [],
    lastfm: "skipped" as LastFmStatus,
  };
  if (!input.location || !hasLocation(input.location)) {
    return empty;
  }

  const now = input.now ?? new Date();
  const endDateTime = windowEnd(now);
  const loadShows = deps?.loadShows ?? loadTicketmasterShows;
  const similarArtists = deps?.similarArtists ?? getSimilarArtists;
  const seeds = input.follows.artists.slice(0, SEED_LIMIT);

  const [nearbyByDistance, nearbyByDate, followed, similarResults, origin] =
    await Promise.all([
    loadShows({
      attractions: [],
      location: input.location,
      endDateTime,
      sort: "distance,asc",
    }).catch(() => [] as SuggestionShowFact[]),
    loadShows({
      attractions: [],
      location: input.location,
      endDateTime,
      sort: "date,asc",
    }).catch(() => [] as SuggestionShowFact[]),
    seeds.length > 0
      ? loadShows({
          attractions: seeds,
          location: input.location,
          endDateTime,
          sort: "date,asc",
        }).catch(() => [] as SuggestionShowFact[])
      : Promise.resolve([] as SuggestionShowFact[]),
    Promise.all(
      seeds.map(async (seed) => {
        const result = await similarArtists(seed.name).catch(
          (): LastFmSimilarResult => ({ ok: false, artists: [] }),
        );
        return { seed: seed.name, result };
      }),
    ),
    resolveSearchOrigin({
      postalCode: input.location.postalCode,
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      radiusMiles: input.location.radiusMiles,
    }).catch(() => null),
  ]);

  const savedShows = origin
    ? input.savedShows.filter((show) => {
        if (show.latitude === null || show.longitude === null) {
          return false;
        }
        return isWithinRadius(
          origin,
          { latitude: show.latitude, longitude: show.longitude },
          origin.radiusMiles,
        );
      })
    : [];

  let lastfm: LastFmStatus = "skipped";
  if (seeds.length > 0 && similarResults.length > 0) {
    const skipped = (result: LastFmSimilarResult) =>
      result.ok && result.skipped;
    const loaded = (result: LastFmSimilarResult) =>
      result.ok && !result.skipped;
    if (similarResults.every((row) => skipped(row.result))) {
      lastfm = "skipped";
    } else if (similarResults.some((row) => loaded(row.result))) {
      lastfm = "ok";
    } else {
      lastfm = "error";
    }
  }

  const pills = buildSuggestionPills({
    follows: input.follows,
    dismissed: input.dismissed,
    similar: similarResults
      .filter((row) => row.result.ok)
      .map((row) => ({
        seedName: row.seed,
        artists: row.result.artists,
      })),
    activity: input.activity,
    shows: dedupeShows([...nearbyByDistance, ...nearbyByDate, ...followed, ...savedShows]),
    origin,
    now,
  });

  return { ...pills, lastfm };
}
