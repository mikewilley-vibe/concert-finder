import { normalizeNameForComparison } from "./name-similarity.ts";

const LASTFM_SIMILAR_URL = "https://ws.audioscrobbler.com/2.0/";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const SIMILAR_LIMIT = "30";

export type SimilarArtist = {
  name: string;
  match: number;
};

export type LastFmSimilarResult =
  | { ok: true; artists: SimilarArtist[]; skipped: boolean }
  | { ok: false; artists: [] };

type CacheEntry = {
  at: number;
  artists: SimilarArtist[];
};

const cache = new Map<string, CacheEntry>();

export function clearLastFmSimilarCache() {
  cache.clear();
}

export function parseLastFmSimilar(payload: unknown): SimilarArtist[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  if ("error" in payload) {
    return [];
  }

  const artist = (payload as { similarartists?: { artist?: unknown } })
    .similarartists?.artist;
  const rows = Array.isArray(artist) ? artist : artist ? [artist] : [];
  const artists: SimilarArtist[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const nameValue = (row as { name?: unknown }).name;
    const matchValue = (row as { match?: unknown }).match;
    const name = typeof nameValue === "string" ? nameValue.trim() : "";
    const match =
      typeof matchValue === "number"
        ? matchValue
        : typeof matchValue === "string"
          ? Number(matchValue)
          : Number.NaN;
    if (!name || !Number.isFinite(match) || match <= 0) {
      continue;
    }
    artists.push({ name, match: Math.min(1, match) });
  }

  return artists;
}

export async function getSimilarArtists(
  artistName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LastFmSimilarResult> {
  const name = artistName.trim();
  const apiKey = process.env.LASTFM_API_KEY?.trim() ?? "";
  if (!name || !apiKey) {
    return { ok: true, artists: [], skipped: true };
  }

  const cacheKey = normalizeNameForComparison(name);
  const cached = cacheKey ? cache.get(cacheKey) : undefined;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ok: true, artists: cached.artists, skipped: false };
  }

  const url = new URL(LASTFM_SIMILAR_URL);
  url.searchParams.set("method", "artist.getSimilar");
  url.searchParams.set("artist", name);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", SIMILAR_LIMIT);
  url.searchParams.set("autocorrect", "1");

  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { ok: false, artists: [] };
    }
    const artists = parseLastFmSimilar(await response.json());
    if (cacheKey) {
      cache.set(cacheKey, { at: Date.now(), artists });
    }
    return { ok: true, artists, skipped: false };
  } catch {
    return { ok: false, artists: [] };
  }
}
