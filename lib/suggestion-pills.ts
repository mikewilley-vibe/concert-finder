import { distanceMiles, type GeoPoint } from "./geo.ts";
import {
  nameSimilarity,
  normalizeNameForComparison,
} from "./name-similarity.ts";

export const SUGGESTION_LIMIT = 12;
const MONTH_DAYS = 31;
const NAME_MATCH = 0.92;
const DISTANCE_BAND_MILES = 15;
const UNKNOWN_DISTANCE_BAND = 999;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type SuggestionSource = "similar" | "nearby" | "activity" | "hosts";

export type SuggestionSignal = "opened" | "saved" | "interested" | "going";

export type SuggestionPill = {
  id: string;
  name: string;
  reason: string;
  source: SuggestionSource;
  imageUrl: string | null;
  city: string | null;
  state: string | null;
};

export type SuggestionShowFact = {
  id: string;
  localDate: string | null;
  city: string | null;
  state: string | null;
  venueId: string | null;
  venueName: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attractions: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
  }>;
};

export type SuggestionFollow = {
  id: string;
  name: string;
};

export type SuggestionActivity = {
  id: string;
  name: string;
  signal: SuggestionSignal;
};

export type SimilarArtistGroup = {
  seedName: string;
  artists: Array<{ name: string; match: number }>;
};

type RankedPill = {
  pill: SuggestionPill;
  priority: number;
  score: number;
  date: string;
  distance: number;
};

const SIGNAL_RANK: Record<SuggestionSignal, number> = {
  going: 4,
  interested: 3,
  saved: 2,
  opened: 1,
};

type ArtistHit = {
  id: string;
  name: string;
  imageUrl: string | null;
  city: string | null;
  state: string | null;
  localDate: string | null;
  showCount: number;
  distanceMiles: number | null;
};

type VenueHit = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  showCount: number;
  soonestDate: string | null;
  followedPlay: { artistName: string; localDate: string | null } | null;
  distanceMiles: number | null;
};

function todayIso(now: Date) {
  return now.toISOString().slice(0, 10);
}

function daysAfter(localDate: string, today: string) {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${localDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }
  return Math.round((end - start) / 86_400_000);
}

export function shortShowDate(localDate: string | null) {
  if (!localDate || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return "";
  }
  const month = Number(localDate.slice(5, 7));
  const day = Number(localDate.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return "";
  }
  return `${MONTHS[month - 1]} ${day}`;
}

export function placeAndDate(city: string | null, localDate: string | null) {
  const place = city?.trim() ?? "";
  const date = shortShowDate(localDate);
  if (place && date) {
    return `${place} · ${date}`;
  }
  return place || date;
}

function cityDate(city: string | null, localDate: string | null) {
  const place = city?.trim() ?? "";
  const date = shortShowDate(localDate);
  if (place && date) {
    return `${place} ${date}`;
  }
  return place || date;
}

function withConnection(base: string, city: string | null, localDate: string | null) {
  const when = cityDate(city, localDate);
  return when ? `${base} · ${when}` : base;
}

function nameKeys(name: string) {
  const full = normalizeNameForComparison(name);
  const core = full.replace(/^(the|a|an)\s+/, "").trim();
  return [...new Set([full, core].filter(Boolean))];
}

function inThisMonth(localDate: string | null, today: string) {
  if (!localDate) {
    return false;
  }
  const days = daysAfter(localDate, today);
  return days !== null && days >= 0 && days <= MONTH_DAYS;
}

function isUpcoming(localDate: string | null, today: string) {
  if (!localDate) {
    return true;
  }
  const days = daysAfter(localDate, today);
  return days !== null && days >= 0;
}

function sooner(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left <= right ? left : right;
}

function milesOf(show: SuggestionShowFact, origin: GeoPoint | null) {
  if (
    !origin ||
    typeof show.latitude !== "number" ||
    typeof show.longitude !== "number" ||
    !Number.isFinite(show.latitude) ||
    !Number.isFinite(show.longitude)
  ) {
    return null;
  }
  return distanceMiles(origin, {
    latitude: show.latitude,
    longitude: show.longitude,
  });
}

function minMiles(current: number | null, next: number | null) {
  if (current === null) {
    return next;
  }
  if (next === null) {
    return current;
  }
  return Math.min(current, next);
}

function distanceBand(miles: number | null) {
  if (miles === null || !Number.isFinite(miles) || miles < 0) {
    return UNKNOWN_DISTANCE_BAND;
  }
  return Math.floor(miles / DISTANCE_BAND_MILES);
}

function preferThisShow(
  currentMiles: number | null,
  nextMiles: number | null,
  currentDate: string | null,
  nextDate: string | null,
) {
  if (nextMiles !== null && currentMiles !== null) {
    const delta = nextMiles - currentMiles;
    if (delta < -0.05) {
      return true;
    }
    if (delta > 0.05) {
      return false;
    }
  } else if (nextMiles !== null) {
    return true;
  } else if (currentMiles !== null) {
    return false;
  }
  const left = currentDate ?? "9999-99-99";
  const right = nextDate ?? "9999-99-99";
  return right < left;
}

export function mergeSimilarArtists(groups: SimilarArtistGroup[]) {
  const byName = new Map<
    string,
    {
      name: string;
      score: number;
      seedCount: number;
      bestSeed: string;
      bestMatch: number;
      matchSum: number;
    }
  >();

  for (const group of groups) {
    const seedName = group.seedName.trim();
    if (!seedName) {
      continue;
    }
    const seen = new Set<string>();
    for (const artist of group.artists) {
      const key = normalizeNameForComparison(artist.name);
      if (!key || seen.has(key)) {
        continue;
      }
      const match = Number.isFinite(artist.match)
        ? Math.min(1, Math.max(0, artist.match))
        : 0;
      if (match <= 0) {
        continue;
      }
      seen.add(key);
      const current = byName.get(key) ?? {
        name: artist.name.trim(),
        score: 0,
        seedCount: 0,
        bestSeed: seedName,
        bestMatch: 0,
        matchSum: 0,
      };
      current.seedCount += 1;
      current.matchSum += match;
      if (match > current.bestMatch) {
        current.bestMatch = match;
        current.bestSeed = seedName;
        current.name = artist.name.trim() || current.name;
      }
      current.score = current.matchSum + current.seedCount;
      byName.set(key, current);
    }
  }

  return [...byName.values()].sort(
    (left, right) =>
      right.score - left.score ||
      right.bestMatch - left.bestMatch ||
      left.name.localeCompare(right.name),
  );
}

export function mergeActivity(rows: SuggestionActivity[]) {
  const byId = new Map<string, SuggestionActivity>();
  for (const row of rows) {
    const id = row.id.trim();
    const name = row.name.trim();
    if (!id) {
      continue;
    }
    const current = byId.get(id);
    if (!current || SIGNAL_RANK[row.signal] > SIGNAL_RANK[current.signal]) {
      byId.set(id, { id, name: name || current?.name || "", signal: row.signal });
    } else if (!current.name && name) {
      byId.set(id, { ...current, name });
    }
  }
  return [...byId.values()];
}

function blockedNames(follows: SuggestionFollow[]) {
  const names = new Set<string>();
  for (const follow of follows) {
    for (const key of nameKeys(follow.name)) {
      names.add(key);
    }
  }
  return names;
}

function findArtist(byId: Map<string, ArtistHit>, byName: Map<string, string>, name: string) {
  for (const key of nameKeys(name)) {
    const id = byName.get(key);
    if (id) {
      return byId.get(id) ?? null;
    }
  }

  let best: { hit: ArtistHit; score: number } | null = null;
  for (const hit of byId.values()) {
    const score = nameSimilarity(name, hit.name);
    if (score >= NAME_MATCH && (!best || score > best.score)) {
      best = { hit, score };
    }
  }
  return best?.hit ?? null;
}

function indexShows(
  shows: SuggestionShowFact[],
  follows: SuggestionFollow[],
  today: string,
  origin: GeoPoint | null,
) {
  const artists = new Map<string, ArtistHit>();
  const artistNames = new Map<string, string>();
  const venues = new Map<string, VenueHit>();
  const followedIds = new Set(follows.map((follow) => follow.id));
  const followedNames = blockedNames(follows);

  for (const show of shows) {
    if (!isUpcoming(show.localDate, today)) {
      continue;
    }
    const month = inThisMonth(show.localDate, today);
    for (const attraction of show.attractions) {
      const id = attraction.id.trim();
      const name = attraction.name.trim();
      if (!id || !name) {
        continue;
      }
      const miles = milesOf(show, origin);
      const current = artists.get(id);
      if (!current) {
        artists.set(id, {
          id,
          name,
          imageUrl: attraction.imageUrl,
          city: show.city,
          state: show.state,
          localDate: show.localDate,
          showCount: month ? 1 : 0,
          distanceMiles: miles,
        });
      } else {
        const useShow = preferThisShow(
          current.distanceMiles,
          miles,
          current.localDate,
          show.localDate,
        );
        artists.set(id, {
          ...current,
          imageUrl: useShow
            ? (attraction.imageUrl ?? current.imageUrl)
            : current.imageUrl,
          city: useShow ? (show.city ?? current.city) : current.city,
          state: useShow ? (show.state ?? current.state) : current.state,
          localDate: useShow ? show.localDate : current.localDate,
          showCount: current.showCount + (month ? 1 : 0),
          distanceMiles: minMiles(current.distanceMiles, miles),
        });
      }
      for (const key of nameKeys(name)) {
        if (!artistNames.has(key)) {
          artistNames.set(key, id);
        }
      }
    }

    const venueId = show.venueId?.trim() ?? "";
    const venueName = show.venueName?.trim() ?? "";
    if (!venueId || !venueName) {
      continue;
    }
    const played = show.attractions.find((attraction) => {
      const id = attraction.id.trim();
      const name = attraction.name.trim();
      return (
        (id && followedIds.has(id)) ||
        nameKeys(name).some((key) => followedNames.has(key))
      );
    });
    const miles = milesOf(show, origin);
    const current = venues.get(venueId);
    const play =
      played && played.name.trim()
        ? { artistName: played.name.trim(), localDate: show.localDate }
        : null;
    if (!current) {
      venues.set(venueId, {
        id: venueId,
        name: venueName,
        city: show.city,
        state: show.state,
        showCount: month ? 1 : 0,
        soonestDate: show.localDate,
        followedPlay: play,
        distanceMiles: miles,
      });
      continue;
    }
    const usePlace = preferThisShow(
      current.distanceMiles,
      miles,
      current.soonestDate,
      show.localDate,
    );
    const nextDate = sooner(current.soonestDate, show.localDate);
    const nextPlay = [current.followedPlay, play]
      .filter((item): item is { artistName: string; localDate: string | null } =>
        Boolean(item),
      )
      .sort((left, right) =>
        (left.localDate ?? "9999").localeCompare(right.localDate ?? "9999"),
      )[0] ?? null;
    venues.set(venueId, {
      ...current,
      city: usePlace ? (show.city ?? current.city) : current.city,
      state: usePlace ? (show.state ?? current.state) : current.state,
      showCount: current.showCount + (month ? 1 : 0),
      soonestDate: nextDate,
      followedPlay: nextPlay,
      distanceMiles: minMiles(current.distanceMiles, miles),
    });
  }

  return { artists, artistNames, venues };
}

function activityReason(
  signal: SuggestionSignal,
  kind: "artist" | "venue",
  city: string | null,
  localDate: string | null,
) {
  const base =
    signal === "going"
      ? "You're going"
      : signal === "interested"
        ? "Interested"
        : signal === "saved"
          ? kind === "venue"
            ? "You saved a show here"
            : "You saved this"
          : kind === "venue"
            ? "You opened a show here"
            : "You opened this";
  return withConnection(base, city, localDate);
}

function takePills(ranked: RankedPill[]) {
  ranked.sort(
    (left, right) =>
      left.priority - right.priority ||
      left.distance - right.distance ||
      right.score - left.score ||
      left.date.localeCompare(right.date) ||
      left.pill.name.localeCompare(right.pill.name),
  );
  const seen = new Set<string>();
  const pills: SuggestionPill[] = [];
  for (const row of ranked) {
    if (seen.has(row.pill.id)) {
      continue;
    }
    seen.add(row.pill.id);
    pills.push(row.pill);
    if (pills.length >= SUGGESTION_LIMIT) {
      break;
    }
  }
  return pills;
}

function excluded(
  id: string,
  name: string,
  ids: Set<string>,
  names: Set<string>,
) {
  if (ids.has(id)) {
    return true;
  }
  return nameKeys(name).some((key) => names.has(key));
}

export function buildSuggestionPills(input: {
  follows: { artists: SuggestionFollow[]; venues: SuggestionFollow[] };
  dismissed: { artists: SuggestionFollow[]; venues: SuggestionFollow[] };
  similar: SimilarArtistGroup[];
  activity: { artists: SuggestionActivity[]; venues: SuggestionActivity[] };
  shows: SuggestionShowFact[];
  origin?: GeoPoint | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const today = todayIso(now);
  const origin = input.origin ?? null;
  const { artists, artistNames, venues } = indexShows(
    input.shows,
    input.follows.artists,
    today,
    origin,
  );
  const followedArtistIds = new Set(input.follows.artists.map((item) => item.id));
  const followedArtistNames = blockedNames(input.follows.artists);
  const followedVenueIds = new Set(input.follows.venues.map((item) => item.id));
  const followedVenueNames = blockedNames(input.follows.venues);
  const dismissedArtistIds = new Set(input.dismissed.artists.map((item) => item.id));
  const dismissedArtistNames = blockedNames(input.dismissed.artists);
  const dismissedVenueIds = new Set(input.dismissed.venues.map((item) => item.id));
  const dismissedVenueNames = blockedNames(input.dismissed.venues);
  const artistRanked: RankedPill[] = [];
  const usedArtists = new Set<string>();

  function artistBlocked(hit: ArtistHit) {
    return (
      excluded(hit.id, hit.name, followedArtistIds, followedArtistNames) ||
      excluded(hit.id, hit.name, dismissedArtistIds, dismissedArtistNames)
    );
  }

  for (const similar of mergeSimilarArtists(input.similar)) {
    if (
      nameKeys(similar.name).some((key) => followedArtistNames.has(key)) ||
      nameKeys(similar.name).some((key) => dismissedArtistNames.has(key))
    ) {
      continue;
    }
    const hit = findArtist(artists, artistNames, similar.name);
    if (!hit || artistBlocked(hit) || usedArtists.has(hit.id)) {
      continue;
    }
    usedArtists.add(hit.id);
    artistRanked.push({
      priority: 0,
      distance: distanceBand(hit.distanceMiles),
      score: similar.score,
      date: hit.localDate ?? "9999-99-99",
      pill: {
        id: hit.id,
        name: hit.name,
        reason: withConnection(`Like ${similar.bestSeed}`, hit.city, hit.localDate),
        source: "similar",
        imageUrl: hit.imageUrl,
        city: hit.city,
        state: hit.state,
      },
    });
  }

  for (const activity of mergeActivity(input.activity.artists)) {
    const hit = artists.get(activity.id);
    if (!hit || artistBlocked(hit) || usedArtists.has(hit.id)) {
      continue;
    }
    usedArtists.add(hit.id);
    artistRanked.push({
      priority: 1,
      distance: distanceBand(hit.distanceMiles),
      score: SIGNAL_RANK[activity.signal],
      date: hit.localDate ?? "9999-99-99",
      pill: {
        id: hit.id,
        name: hit.name,
        reason: activityReason(activity.signal, "artist", hit.city, hit.localDate),
        source: "activity",
        imageUrl: hit.imageUrl,
        city: hit.city,
        state: hit.state,
      },
    });
  }

  const nearbyArtists = [...artists.values()]
    .filter((hit) => !artistBlocked(hit) && !usedArtists.has(hit.id))
    .filter((hit) => placeAndDate(hit.city, hit.localDate));
  for (const hit of nearbyArtists) {
    artistRanked.push({
      priority: 2,
      distance: distanceBand(hit.distanceMiles),
      score: hit.showCount,
      date: hit.localDate ?? "9999-99-99",
      pill: {
        id: hit.id,
        name: hit.name,
        reason: placeAndDate(hit.city, hit.localDate),
        source: "nearby",
        imageUrl: hit.imageUrl,
        city: hit.city,
        state: hit.state,
      },
    });
  }

  const venueRanked: RankedPill[] = [];
  const usedVenues = new Set<string>();
  const activityVenues = new Map(
    mergeActivity(input.activity.venues).map((row) => [row.id, row]),
  );

  function venueBlocked(hit: VenueHit) {
    return (
      excluded(hit.id, hit.name, followedVenueIds, followedVenueNames) ||
      excluded(hit.id, hit.name, dismissedVenueIds, dismissedVenueNames)
    );
  }

  for (const hit of venues.values()) {
    if (venueBlocked(hit) || !hit.followedPlay) {
      continue;
    }
    usedVenues.add(hit.id);
    const date = shortShowDate(hit.followedPlay.localDate);
    venueRanked.push({
      priority: 0,
      distance: distanceBand(hit.distanceMiles),
      score: 1,
      date: hit.followedPlay.localDate ?? "9999-99-99",
      pill: {
        id: hit.id,
        name: hit.name,
        reason: date
          ? `${hit.followedPlay.artistName} plays here ${date}`
          : `${hit.followedPlay.artistName} plays here`,
        source: "hosts",
        imageUrl: null,
        city: hit.city,
        state: hit.state,
      },
    });
  }

  for (const [id, activity] of activityVenues) {
    const hit = venues.get(id);
    if (!hit || venueBlocked(hit) || usedVenues.has(hit.id)) {
      continue;
    }
    usedVenues.add(hit.id);
    venueRanked.push({
      priority: 1,
      distance: distanceBand(hit.distanceMiles),
      score: SIGNAL_RANK[activity.signal],
      date: hit.soonestDate ?? "9999-99-99",
      pill: {
        id: hit.id,
        name: hit.name,
        reason: activityReason(activity.signal, "venue", hit.city, hit.soonestDate),
        source: "activity",
        imageUrl: null,
        city: hit.city,
        state: hit.state,
      },
    });
  }

  for (const hit of venues.values()) {
    if (venueBlocked(hit) || usedVenues.has(hit.id) || hit.showCount < 1) {
      continue;
    }
    venueRanked.push({
      priority: 2,
      distance: distanceBand(hit.distanceMiles),
      score: hit.showCount,
      date: hit.soonestDate ?? "9999-99-99",
      pill: {
        id: hit.id,
        name: hit.name,
        reason: `Hosts ${hit.showCount} ${hit.showCount === 1 ? "show" : "shows"} this month`,
        source: "hosts",
        imageUrl: null,
        city: hit.city,
        state: hit.state,
      },
    });
  }

  return {
    artists: takePills(artistRanked),
    venues: takePills(venueRanked),
  };
}
