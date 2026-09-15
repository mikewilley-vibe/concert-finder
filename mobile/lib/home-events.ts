import {
  searchUpcomingShows,
  type FollowedRef,
  type TicketmasterShow,
} from "./api";
import { toFollowedRef, type FollowedItem } from "./follows";
import {
  upcomingSearchFields,
  type HomeLocation,
} from "./home-location";
import {
  ARTIST_DAYS,
  NEARBY_DAYS,
  artistReachMiles,
  endDateTimeAfterDays,
} from "./show-windows";

const CACHE_TTL_MS = 2 * 60 * 1000;
const FOLLOW_CHUNK = 20;

export type HomeEventSets = {
  nearby: TicketmasterShow[];
  followed: TicketmasterShow[];
};

type CacheEntry = {
  key: string;
  at: number;
  value: HomeEventSets;
};

let cache: CacheEntry | null = null;
const inflight = new Map<string, Promise<HomeEventSets>>();

function cacheKey(
  location: HomeLocation,
  artists: readonly FollowedItem[],
  venues: readonly FollowedItem[],
) {
  return JSON.stringify({
    fields: upcomingSearchFields(location),
    source: location.source,
    artists: artists.map((item) => item.item_key).sort(),
    venues: venues.map((item) => item.item_key).sort(),
  });
}

function mergeShows(batches: TicketmasterShow[][]) {
  const shows: TicketmasterShow[] = [];
  const seen = new Set<string>();
  for (const batch of batches) {
    for (const show of batch) {
      if (seen.has(show.id)) {
        continue;
      }
      seen.add(show.id);
      shows.push(show);
    }
  }
  return shows;
}

function chunkRefs(refs: FollowedRef[]) {
  const chunks: FollowedRef[][] = [];
  for (let index = 0; index < refs.length; index += FOLLOW_CHUNK) {
    chunks.push(refs.slice(index, index + FOLLOW_CHUNK));
  }
  return chunks;
}

function searchChunks(
  search: typeof searchUpcomingShows,
  chunks: FollowedRef[][],
  kind: "artist" | "venue",
  extra: {
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    radiusMiles?: number;
    endDateTime?: string;
  },
) {
  if (chunks.length === 0) {
    return Promise.resolve([] as TicketmasterShow[]);
  }
  return Promise.all(
    chunks.map((chunk) =>
      search({
        attractions: kind === "artist" ? chunk : [],
        venues: kind === "venue" ? chunk : [],
        ...extra,
        pageSize: 50,
      }).then((result) => result.shows),
    ),
  ).then((batches) => mergeShows(batches));
}

export async function loadHomeEventSets(input: {
  location: HomeLocation;
  artists: readonly FollowedItem[];
  venues: readonly FollowedItem[];
  now?: Date;
  search?: typeof searchUpcomingShows;
}): Promise<HomeEventSets> {
  const search = input.search ?? searchUpcomingShows;
  const key = cacheKey(input.location, input.artists, input.venues);
  const now = Date.now();
  if (cache && cache.key === key && now - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    const fields = upcomingSearchFields(input.location);
    const hasLocation = Boolean(fields.latitude || fields.postalCode);
    const nearbyEnd = endDateTimeAfterDays(NEARBY_DAYS + 1, input.now);
    const venueEnd = endDateTimeAfterDays(ARTIST_DAYS + 1, input.now);
    const followRadius = artistReachMiles(input.location.radiusMiles);
    const attractions = input.artists.map(toFollowedRef);
    const venues = input.venues.map(toFollowedRef);

    const nearbyPromise = hasLocation
      ? search({
          attractions: [],
          venues: [],
          ...fields,
          endDateTime: nearbyEnd,
          pageSize: 50,
        }).then((result) => result.shows)
      : Promise.resolve([] as TicketmasterShow[]);

    // Favorite-artist dates are worldwide: no postal/lat/radius filter.
    const artistPromise = searchChunks(
      search,
      chunkRefs(attractions),
      "artist",
      {},
    );
    const venueLocation = fields.latitude
      ? { ...fields, radiusMiles: followRadius }
      : fields;
    const venuePromise = searchChunks(
      search,
      chunkRefs(venues),
      "venue",
      {
        ...venueLocation,
        endDateTime: venueEnd,
      },
    );
    const followedPromise = Promise.all([artistPromise, venuePromise]).then(
      (batches) => mergeShows(batches),
    );

    const [nearby, followed] = await Promise.all([
      nearbyPromise,
      followedPromise,
    ]);
    const value = { nearby, followed };
    cache = { key, at: Date.now(), value };
    return value;
  })();

  inflight.set(key, request);
  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

export function clearHomeEventSetsCache() {
  cache = null;
  inflight.clear();
}
