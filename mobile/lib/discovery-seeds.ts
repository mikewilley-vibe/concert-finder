export const DISCOVERY_SEEDS_STORAGE_KEY = "showsignal:v1:discovery-seeds";
export const MAX_DISCOVERY_SEEDS = 10;

export type DiscoverySeed = {
  id: string;
  label: string;
  genreId: string | null;
  genreName: string | null;
  subGenreId: string | null;
  subGenreName: string | null;
  savedAt: number;
  source: "search" | "follow";
};

const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseDiscoverySeeds(raw: string | null): DiscoverySeed[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const seeds: DiscoverySeed[] = [];
    const seen = new Set<string>();
    for (const row of parsed) {
      if (!row || typeof row !== "object") {
        continue;
      }
      const record = row as Record<string, unknown>;
      const id = optionalText(record.id) ?? "";
      const label = optionalText(record.label) ?? "";
      if (!ID_PATTERN.test(id) || !label || seen.has(id)) {
        continue;
      }
      const source = record.source === "follow" ? "follow" : "search";
      const savedAt =
        typeof record.savedAt === "number" && Number.isFinite(record.savedAt)
          ? record.savedAt
          : 0;
      seen.add(id);
      seeds.push({
        id,
        label,
        genreId: optionalText(record.genreId),
        genreName: optionalText(record.genreName),
        subGenreId: optionalText(record.subGenreId),
        subGenreName: optionalText(record.subGenreName),
        savedAt,
        source,
      });
    }
    return seeds
      .sort((a, b) => b.savedAt - a.savedAt)
      .slice(0, MAX_DISCOVERY_SEEDS);
  } catch {
    return [];
  }
}

export function rememberDiscoverySeed(
  current: DiscoverySeed[],
  next: Omit<DiscoverySeed, "savedAt"> & { savedAt?: number },
) {
  const savedAt = next.savedAt ?? Date.now();
  const row: DiscoverySeed = { ...next, savedAt };
  return [row, ...current.filter((item) => item.id !== row.id)].slice(
    0,
    MAX_DISCOVERY_SEEDS,
  );
}

export function serializeDiscoverySeeds(seeds: DiscoverySeed[]) {
  return JSON.stringify(seeds.slice(0, MAX_DISCOVERY_SEEDS));
}
