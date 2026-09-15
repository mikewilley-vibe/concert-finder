import type { TicketmasterShow } from "./api";
import type { InteractionSignals } from "./interaction-signals";

export const NEARBY_DAYS = 7;
export const ARTIST_DAYS = 30;
export const RADAR_DAYS = 14;
export const HOME_NEAR_YOU_LIMIT = 8;
export const HOME_ARTISTS_LIMIT = 10;
/** Next upcoming shows kept per followed artist on Home and See All. */
export const SHOWS_PER_FAVORITE_ARTIST = 2;

export const FAVORITE_ARTIST_WEIGHT = 1000;
export const FAVORITE_VENUE_WEIGHT = 400;
export const MAX_ENGAGEMENT_WEIGHT = 120;
export const IN_RADIUS_WEIGHT = 80;
export const DISTANCE_WEIGHT = 40;
export const SOONER_WEIGHT = 25;

const RADAR_MIN_SCORE = FAVORITE_ARTIST_WEIGHT + IN_RADIUS_WEIGHT;
const EARTH_RADIUS_MILES = 3958.7613;

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type FavoriteIdSource = {
  item_key: string;
};

export type FavoriteIds = {
  artistIds: ReadonlySet<string>;
  venueIds: ReadonlySet<string>;
};

export type DatedShow = {
  startsAt?: string | null;
  localDate?: string | null;
};

export type RankableShow = {
  id: string;
  startsAt?: string | null;
  localDate?: string | null;
  venueId?: string | null;
  venueLatitude?: number | null;
  venueLongitude?: number | null;
  attractions: Array<{ id: string; name?: string | null }>;
};

export type RankedShow<T extends RankableShow = RankableShow> = {
  show: T;
  score: number;
  distanceMiles: number | null;
  inRadius: boolean;
  favoriteArtist: boolean;
  favoriteVenue: boolean;
  engagement: number;
};

export type RankingContext = {
  favorites: FavoriteIds;
  origin: GeoPoint | null;
  radiusMiles: number;
  signals?: InteractionSignals;
  now?: Date;
};

export type HomeCard = RankedShow<TicketmasterShow> & {
  scanDate: string;
  distanceLabel: string | null;
  badges: string[];
  artistId: string | null;
  artistLabel: string | null;
};

export type HomeFeed = {
  radar: HomeCard | null;
  nearYou: HomeCard[];
  yourArtists: HomeCard[];
  nearYouTotal: number;
  yourArtistsTotal: number;
};

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function distanceMiles(from: GeoPoint, to: GeoPoint) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(to.longitude - from.longitude);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(hav)));
}

export function formatDistanceMiles(miles: number) {
  if (miles < 1) {
    return "Under 1 mi";
  }
  return `${Math.round(miles)} mi`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localStamp(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addLocalDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function showLocalStamp(show: DatedShow, now = new Date()) {
  const localDate = show.localDate?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return localDate;
  }
  const startsAt = show.startsAt?.trim() ?? "";
  if (startsAt) {
    const parsed = new Date(startsAt);
    if (!Number.isNaN(parsed.getTime())) {
      return localStamp(parsed);
    }
  }
  return localStamp(now);
}

export function showSortKey(show: DatedShow) {
  const startsAt = show.startsAt?.trim() ?? "";
  if (startsAt) {
    return startsAt;
  }
  const localDate = show.localDate?.trim() ?? "";
  if (localDate) {
    return localDate;
  }
  return "\uFFFF";
}

export function isWithinDays(show: DatedShow, days: number, now = new Date()) {
  const stamp = showLocalStamp(show, now);
  const today = localStamp(now);
  const end = localStamp(addLocalDays(now, days - 1));
  return stamp >= today && stamp <= end;
}

export function isUpcomingShow(show: DatedShow, now = new Date()) {
  return showLocalStamp(show, now) >= localStamp(now);
}

export function endDateTimeAfterDays(days: number, now = new Date()) {
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  end.setUTCMinutes(Math.floor(end.getUTCMinutes() / 5) * 5, 0, 0);
  return end.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function scanDateLabel(show: DatedShow, now = new Date()) {
  const stamp = showLocalStamp(show, now);
  const today = localStamp(now);
  if (stamp === today) {
    return "TONIGHT";
  }
  if (stamp === localStamp(addLocalDays(now, 1))) {
    return "TOMORROW";
  }
  const [year, month, day] = stamp.split("-").map(Number);
  if (!year || !month || !day) {
    return stamp.toUpperCase();
  }
  const date = new Date(year, month - 1, day);
  const weekday = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const monthLabel = date
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  return `${weekday} ${monthLabel} ${day}`;
}

export function artistReachMiles(radiusMiles: number) {
  const radius = Number.isFinite(radiusMiles) ? radiusMiles : 100;
  return Math.min(500, Math.max(radius, radius + 50));
}

function idSet(items: readonly FavoriteIdSource[]) {
  return new Set(items.map((item) => item.item_key.trim()).filter(Boolean));
}

export function favoriteIdsFromFollows(
  artists: readonly FavoriteIdSource[],
  venues: readonly FavoriteIdSource[],
): FavoriteIds {
  return {
    artistIds: idSet(artists),
    venueIds: idSet(venues),
  };
}

export function showHasFavoriteArtist(
  show: { attractions?: Array<{ id?: string | null }> },
  artistIds: ReadonlySet<string>,
) {
  return favoriteArtistIdsOnShow(show, artistIds).length > 0;
}

function favoriteArtistIdsOnShow(
  show: { attractions?: Array<{ id?: string | null }> },
  artistIds: ReadonlySet<string>,
) {
  if (artistIds.size === 0) {
    return [];
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const artist of show.attractions ?? []) {
    const id = artist.id?.trim() ?? "";
    if (!id || !artistIds.has(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function attractionName(
  show: { attractions?: Array<{ id?: string | null; name?: string | null }> },
  artistId: string,
) {
  const match = (show.attractions ?? []).find(
    (artist) => (artist.id?.trim() ?? "") === artistId,
  );
  const name = match?.name?.trim() ?? "";
  return name || artistId;
}

export function showHasFavoriteVenue(
  show: { venueId?: string | null },
  venueIds: ReadonlySet<string>,
) {
  if (venueIds.size === 0) {
    return false;
  }
  const venueId = show.venueId?.trim() ?? "";
  return Boolean(venueId) && venueIds.has(venueId);
}

function engagementScore(signals: {
  views: number;
  taps: number;
  saves: number;
  ticketOpens: number;
  shares: number;
  interested?: number;
  going?: number;
} | undefined) {
  if (!signals) {
    return 0;
  }
  return (
    signals.views * 1 +
    signals.taps * 8 +
    signals.saves * 20 +
    signals.ticketOpens * 25 +
    signals.shares * 15 +
    (signals.interested ?? 0) * 40 +
    (signals.going ?? 0) * 80
  );
}

function showDistanceMiles(show: RankableShow, origin: GeoPoint | null) {
  if (
    !origin ||
    show.venueLatitude == null ||
    show.venueLongitude == null ||
    !Number.isFinite(show.venueLatitude) ||
    !Number.isFinite(show.venueLongitude)
  ) {
    return null;
  }
  return distanceMiles(origin, {
    latitude: show.venueLatitude,
    longitude: show.venueLongitude,
  });
}

function soonerBonus(show: RankableShow, now: Date) {
  const parsed = Date.parse(showSortKey(show));
  if (Number.isNaN(parsed)) {
    return 0;
  }
  const days = Math.max(0, (parsed - now.getTime()) / (24 * 60 * 60 * 1000));
  return SOONER_WEIGHT * (1 / (1 + days / 7));
}

function distanceBonus(miles: number | null, radiusMiles: number) {
  if (miles == null) {
    return DISTANCE_WEIGHT * 0.4;
  }
  const radius = Math.max(1, radiusMiles);
  return DISTANCE_WEIGHT * (1 / (1 + miles / radius));
}

export function scoreShow<T extends RankableShow>(
  show: T,
  context: RankingContext,
): RankedShow<T> {
  const now = context.now ?? new Date();
  const favoriteArtist = showHasFavoriteArtist(show, context.favorites.artistIds);
  const favoriteVenue = showHasFavoriteVenue(show, context.favorites.venueIds);
  const miles = showDistanceMiles(show, context.origin);
  const inRadius =
    miles == null ? context.origin == null : miles <= context.radiusMiles;
  const eventSignals = context.signals?.events[show.id];
  const engagement = Math.min(MAX_ENGAGEMENT_WEIGHT, engagementScore(eventSignals));

  let score = 0;
  if (favoriteArtist) score += FAVORITE_ARTIST_WEIGHT;
  if (favoriteVenue) score += FAVORITE_VENUE_WEIGHT;
  score += engagement;
  if (inRadius) score += IN_RADIUS_WEIGHT;
  score += distanceBonus(miles, context.radiusMiles);
  score += soonerBonus(show, now);

  return {
    show,
    score,
    distanceMiles: miles,
    inRadius,
    favoriteArtist,
    favoriteVenue,
    engagement,
  };
}

function compareRankedShows<T extends RankableShow>(
  left: RankedShow<T>,
  right: RankedShow<T>,
) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  const byDate = showSortKey(left.show).localeCompare(showSortKey(right.show));
  return byDate !== 0 ? byDate : left.show.id.localeCompare(right.show.id);
}

function compareNearYouShows<T extends RankableShow>(
  left: RankedShow<T>,
  right: RankedShow<T>,
) {
  const byDate = showSortKey(left.show).localeCompare(showSortKey(right.show));
  if (byDate !== 0) {
    return byDate;
  }
  const leftFavorite = Number(left.favoriteArtist) * 2 + Number(left.favoriteVenue);
  const rightFavorite = Number(right.favoriteArtist) * 2 + Number(right.favoriteVenue);
  if (rightFavorite !== leftFavorite) {
    return rightFavorite - leftFavorite;
  }
  const leftMiles = left.distanceMiles ?? Number.POSITIVE_INFINITY;
  const rightMiles = right.distanceMiles ?? Number.POSITIVE_INFINITY;
  if (leftMiles !== rightMiles) {
    return leftMiles - rightMiles;
  }
  return left.show.id.localeCompare(right.show.id);
}

function compareArtistSectionShows<T extends RankableShow>(
  left: RankedShow<T>,
  right: RankedShow<T>,
) {
  const byDate = showSortKey(left.show).localeCompare(showSortKey(right.show));
  if (byDate !== 0) {
    return byDate;
  }
  if (left.inRadius !== right.inRadius) {
    return left.inRadius ? -1 : 1;
  }
  const leftMiles = left.distanceMiles ?? Number.POSITIVE_INFINITY;
  const rightMiles = right.distanceMiles ?? Number.POSITIVE_INFINITY;
  if (leftMiles !== rightMiles) {
    return leftMiles - rightMiles;
  }
  return compareRankedShows(left, right);
}

export function pickNextShowsPerFavoriteArtist<T extends RankableShow>(
  ranked: readonly RankedShow<T>[],
  artistIds: ReadonlySet<string>,
  input: { now?: Date; limitPerArtist?: number } = {},
): Array<{ artistId: string; artistName: string; item: RankedShow<T> }> {
  const now = input.now ?? new Date();
  const limitPerArtist = input.limitPerArtist ?? SHOWS_PER_FAVORITE_ARTIST;
  if (artistIds.size === 0 || limitPerArtist < 1) {
    return [];
  }

  const chronological = [...ranked]
    .filter(
      (item) =>
        isUpcomingShow(item.show, now) &&
        showHasFavoriteArtist(item.show, artistIds),
    )
    .sort(compareArtistSectionShows);

  const pickedByArtist = new Map<string, RankedShow<T>[]>();
  for (const item of chronological) {
    for (const artistId of favoriteArtistIdsOnShow(item.show, artistIds)) {
      const list = pickedByArtist.get(artistId) ?? [];
      if (list.length >= limitPerArtist) {
        continue;
      }
      list.push(item);
      pickedByArtist.set(artistId, list);
    }
  }

  const artistOrder = [...pickedByArtist.entries()].sort((left, right) => {
    const byShow = compareArtistSectionShows(left[1][0], right[1][0]);
    return byShow !== 0 ? byShow : left[0].localeCompare(right[0]);
  });

  const rows: Array<{
    artistId: string;
    artistName: string;
    item: RankedShow<T>;
  }> = [];
  for (const [artistId, items] of artistOrder) {
    const artistName = attractionName(items[0].show, artistId);
    for (const item of items) {
      rows.push({ artistId, artistName, item });
    }
  }
  return rows;
}

function uniqueShows(shows: readonly TicketmasterShow[]) {
  const seen = new Set<string>();
  const unique: TicketmasterShow[] = [];
  for (const show of shows) {
    if (seen.has(show.id)) {
      continue;
    }
    seen.add(show.id);
    unique.push(show);
  }
  return unique;
}

function badgesFor(ranked: RankedShow<TicketmasterShow>) {
  const badges: string[] = [];
  if (ranked.favoriteArtist) {
    badges.push("Favorite artist");
  } else if (ranked.favoriteVenue) {
    badges.push("Favorite venue");
  }
  if (ranked.show.priceLabel) {
    badges.push(ranked.show.priceLabel);
  } else if (ranked.show.statusLabel) {
    badges.push(ranked.show.statusLabel);
  }
  return badges;
}

function toCard(
  ranked: RankedShow<TicketmasterShow>,
  now: Date,
  artist?: { id: string; name: string },
): HomeCard {
  return {
    ...ranked,
    scanDate: scanDateLabel(ranked.show, now),
    distanceLabel:
      ranked.distanceMiles == null
        ? null
        : formatDistanceMiles(ranked.distanceMiles),
    badges: badgesFor(ranked),
    artistId: artist?.id ?? null,
    artistLabel: artist?.name ?? null,
  };
}

export function isStrongRadarShow(
  card: RankedShow<TicketmasterShow>,
  now: Date,
) {
  return (
    card.favoriteArtist &&
    card.inRadius &&
    isWithinDays(card.show, RADAR_DAYS, now) &&
    card.score >= RADAR_MIN_SCORE
  );
}

export function buildHomeFeed(input: {
  nearbyShows: readonly TicketmasterShow[];
  followedShows: readonly TicketmasterShow[];
  favorites: FavoriteIds;
  origin: RankingContext["origin"];
  radiusMiles: number;
  signals?: InteractionSignals;
  now?: Date;
}): HomeFeed {
  const now = input.now ?? new Date();
  const context: RankingContext = {
    favorites: input.favorites,
    origin: input.origin,
    radiusMiles: input.radiusMiles,
    signals: input.signals,
    now,
  };

  const merged = uniqueShows([...input.nearbyShows, ...input.followedShows]).map(
    (show) => scoreShow(show, context),
  );

  const nearYou = merged
    .filter(
      (item) =>
        isWithinDays(item.show, NEARBY_DAYS, now) &&
        (item.inRadius || item.distanceMiles == null),
    )
    .sort(compareNearYouShows);

  const radarCandidate = [...nearYou]
    .filter((item) => isStrongRadarShow(item, now))
    .sort((left, right) => right.score - left.score)[0];

  const radar = radarCandidate ? toCard(radarCandidate, now) : null;
  const nearYouWithoutRadar = radar
    ? nearYou.filter((item) => item.show.id !== radar.show.id)
    : nearYou;

  const yourArtists = pickNextShowsPerFavoriteArtist(
    merged,
    input.favorites.artistIds,
    { now },
  );

  return {
    radar,
    nearYou: nearYouWithoutRadar.map((item) => toCard(item, now)),
    yourArtists: yourArtists.map((row) =>
      toCard(row.item, now, { id: row.artistId, name: row.artistName }),
    ),
    nearYouTotal: nearYouWithoutRadar.length,
    yourArtistsTotal: yourArtists.length,
  };
}

export function homeShowMeta(card: HomeCard) {
  const place = [
    card.show.venueName,
    [card.show.city, card.show.state].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  return [card.show.timeLabel, place, card.distanceLabel, ...card.badges]
    .filter(Boolean)
    .join(" · ");
}

export function homeShowSubtitle(card: HomeCard) {
  return [card.scanDate, homeShowMeta(card)].filter(Boolean).join(" · ");
}

export function homeArtistKicker(card: HomeCard) {
  return card.artistLabel
    ? `${card.artistLabel} · ${card.scanDate}`
    : card.scanDate;
}

export function previewYourArtists(
  cards: readonly HomeCard[],
  limit = HOME_ARTISTS_LIMIT,
) {
  if (cards.length <= limit) {
    return [...cards];
  }
  const preview: HomeCard[] = [];
  let index = 0;
  while (index < cards.length) {
    const artistId = cards[index].artistId ?? cards[index].show.id;
    const group: HomeCard[] = [];
    while (index < cards.length) {
      const currentId = cards[index].artistId ?? cards[index].show.id;
      if (currentId !== artistId) {
        break;
      }
      group.push(cards[index]);
      index += 1;
    }
    if (preview.length >= limit) {
      break;
    }
    preview.push(...group);
  }
  return preview;
}
