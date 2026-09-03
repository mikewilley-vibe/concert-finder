import {
  fallbackSearchToken,
  isDirectNameMatch,
  MAX_NAME_SUGGESTIONS,
  nameSimilarity,
  normalizeNameForComparison,
  SUGGEST_NAME_SIMILARITY,
} from "./name-similarity";

const TICKETMASTER_HOST = "https://app.ticketmaster.com";
const ATTRACTIONS_PATH = "/discovery/v2/attractions.json";
const SUGGEST_PATH = "/discovery/v2/suggest.json";
const VENUES_PATH = "/discovery/v2/venues.json";
const EVENTS_PATH = "/discovery/v2/events.json";
const RESULT_LIMIT = 8;
const FALLBACK_CANDIDATE_LIMIT = 24;
const EVENT_PAGE_SIZE = 20;
export const MAX_FOLLOWED_IDS = 8;
const MIN_KEYWORD_LENGTH = 2;
const MAX_KEYWORD_LENGTH = 80;
const ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

export type TicketmasterAttraction = {
  id: string;
  name: string;
  image?: string;
};

export type TicketmasterVenue = {
  id: string;
  name: string;
  city?: string;
  state?: string;
};

export type TicketmasterShow = {
  id: string;
  name: string;
  dateLabel: string;
  timeLabel?: string;
  venueName: string;
  city: string;
  state: string;
  url?: string;
  image?: string;
  matchedLabels: string[];
};

export type UpcomingShowsResult =
  | { ok: true; shows: TicketmasterShow[] }
  | { ok: false; status: number; message: string };

export type FollowedRef = {
  id: string;
  label: string;
};

export type AttractionSearchResult =
  | { ok: true; attractions: TicketmasterAttraction[] }
  | { ok: false; status: number; message: string };

export type VenueSearchResult =
  | { ok: true; venues: TicketmasterVenue[] }
  | { ok: false; status: number; message: string };

type TicketmasterFailure = {
  ok: false;
  status: number;
  message: string;
  cause?: "auth" | "rate_limit";
};

function normalizeKeyword(value: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export function parseSearchKeyword(value: string | null) {
  const keyword = normalizeKeyword(value);

  if (keyword.length < MIN_KEYWORD_LENGTH) {
    return {
      ok: false as const,
      status: 400,
      message: "Enter at least 2 characters to search.",
    };
  }

  if (keyword.length > MAX_KEYWORD_LENGTH) {
    return {
      ok: false as const,
      status: 400,
      message: "Keep the search under 80 characters.",
    };
  }

  return { ok: true as const, keyword };
}

export const parseAttractionKeyword = parseSearchKeyword;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function readName(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const name = (value as { name?: unknown }).name;
  return typeof name === "string" ? name.trim() : "";
}

function readState(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as { stateCode?: unknown; name?: unknown };
  if (typeof record.stateCode === "string" && record.stateCode.trim()) {
    return record.stateCode.trim();
  }

  return typeof record.name === "string" ? record.name.trim() : "";
}

function pickImage(images: unknown) {
  if (!Array.isArray(images)) {
    return undefined;
  }

  const urls = images
    .map((image) => {
      if (!image || typeof image !== "object") {
        return null;
      }

      const record = image as {
        url?: unknown;
        fallback?: unknown;
        ratio?: unknown;
      };
      const url = typeof record.url === "string" ? record.url : "";
      if (!isHttpUrl(url)) {
        return null;
      }

      return {
        url,
        fallback: record.fallback === true,
        ratio: typeof record.ratio === "string" ? record.ratio : "",
      };
    })
    .filter((image): image is NonNullable<typeof image> => Boolean(image));

  const preferred =
    urls.find((image) => !image.fallback && image.ratio === "16_9") ??
    urls.find((image) => !image.fallback) ??
    urls[0];

  return preferred?.url;
}

function mapAttractions(
  payload: unknown,
  limit = RESULT_LIMIT,
): TicketmasterAttraction[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const embedded = (payload as { _embedded?: { attractions?: unknown } })
    ._embedded;
  const rows = Array.isArray(embedded?.attractions)
    ? embedded.attractions
    : [];
  const attractions: TicketmasterAttraction[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const record = row as { id?: unknown; name?: unknown; images?: unknown };
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!id || !name || seen.has(id)) {
      continue;
    }

    seen.add(id);
    const attraction: TicketmasterAttraction = { id, name };
    const image = pickImage(record.images);
    if (image) {
      attraction.image = image;
    }

    attractions.push(attraction);
    if (attractions.length >= limit) {
      break;
    }
  }

  return attractions;
}

function mapVenues(payload: unknown): TicketmasterVenue[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const embedded = (payload as { _embedded?: { venues?: unknown } })._embedded;
  const rows = Array.isArray(embedded?.venues) ? embedded.venues : [];
  const venues: TicketmasterVenue[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const record = row as {
      id?: unknown;
      name?: unknown;
      city?: unknown;
      state?: unknown;
    };
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!id || !name) {
      continue;
    }

    const venue: TicketmasterVenue = { id, name };
    const city = readName(record.city);
    const state = readState(record.state);
    if (city) {
      venue.city = city;
    }
    if (state) {
      venue.state = state;
    }

    venues.push(venue);
    if (venues.length >= RESULT_LIMIT) {
      break;
    }
  }

  return venues;
}

async function ticketmasterGet(
  path: string,
  params: Record<string, string>,
): Promise<{ ok: true; payload: unknown } | TicketmasterFailure> {
  const apiKey = process.env.TICKETMASTER_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      message: "Search is not configured on the server yet.",
      cause: "auth",
    };
  }

  const url = new URL(path, TICKETMASTER_HOST);
  url.searchParams.set("apikey", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return {
      ok: false,
      status: 502,
      message: "Unable to load Ticketmaster right now.",
    };
  }

  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      status: 502,
      message: "Ticketmaster search is not set up correctly.",
      cause: "auth",
    };
  }

  if (response.status === 429) {
    return {
      ok: false,
      status: 429,
      message:
        "Ticketmaster is receiving too many requests right now. Try again shortly.",
      cause: "rate_limit",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      message: "Unable to load Ticketmaster right now.",
    };
  }

  try {
    return { ok: true, payload: await response.json() };
  } catch {
    return {
      ok: false,
      status: 502,
      message: "Unable to load Ticketmaster right now.",
    };
  }
}

export async function searchTicketmasterAttractions(
  keyword: string,
  size = RESULT_LIMIT,
): Promise<AttractionSearchResult> {
  const result = await ticketmasterGet(ATTRACTIONS_PATH, {
    keyword,
    size: String(size),
  });
  if (!result.ok) {
    return result;
  }

  return { ok: true, attractions: mapAttractions(result.payload, size) };
}

function rankAttractionSuggestions(
  query: string,
  candidates: TicketmasterAttraction[],
) {
  const ranked = candidates
    .map((attraction) => ({
      attraction,
      score: nameSimilarity(query, attraction.name),
    }))
    .filter((row) => row.score >= SUGGEST_NAME_SIMILARITY)
    .sort((a, b) => b.score - a.score || a.attraction.name.localeCompare(b.attraction.name));

  const unique: TicketmasterAttraction[] = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    if (seen.has(row.attraction.id)) {
      continue;
    }
    seen.add(row.attraction.id);
    unique.push(row.attraction);
    if (unique.length >= MAX_NAME_SUGGESTIONS) {
      break;
    }
  }

  return unique;
}

export type AttractionFollowSearchResult =
  | {
      ok: true;
      attractions: TicketmasterAttraction[];
      suggestions: TicketmasterAttraction[];
    }
  | { ok: false; status: number; message: string };

export async function searchTicketmasterAttractionsForFollow(
  keyword: string,
): Promise<AttractionFollowSearchResult> {
  const direct = await searchTicketmasterAttractions(keyword);
  if (!direct.ok) {
    return direct;
  }

  if (
    direct.attractions.some((attraction) =>
      isDirectNameMatch(keyword, attraction.name),
    )
  ) {
    return { ok: true, attractions: direct.attractions, suggestions: [] };
  }

  const token = fallbackSearchToken(keyword);
  let candidates: TicketmasterAttraction[] = [];

  if (token && token !== normalizeNameForComparison(keyword)) {
    const fallback = await searchTicketmasterAttractions(
      token,
      FALLBACK_CANDIDATE_LIMIT,
    );
    if (!fallback.ok) {
      if (fallback.status === 429) {
        return fallback;
      }
    } else {
      candidates = fallback.attractions;
    }
  } else {
    const suggested = await ticketmasterGet(SUGGEST_PATH, { keyword });
    if (!suggested.ok) {
      if (suggested.status === 429) {
        return suggested;
      }
    } else {
      candidates = mapAttractions(suggested.payload, FALLBACK_CANDIDATE_LIMIT);
    }
  }

  const suggestions = rankAttractionSuggestions(keyword, candidates);
  if (suggestions.length > 0) {
    return { ok: true, attractions: [], suggestions };
  }

  return {
    ok: true,
    attractions: direct.attractions,
    suggestions: [],
  };
}

export async function searchTicketmasterVenues(
  keyword: string,
): Promise<VenueSearchResult> {
  const result = await ticketmasterGet(VENUES_PATH, {
    keyword,
    size: String(RESULT_LIMIT),
  });
  if (!result.ok) {
    return result;
  }

  return { ok: true, venues: mapVenues(result.payload) };
}

function parseFollowedRefs(value: unknown): FollowedRef[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const refs: FollowedRef[] = [];
  const seen = new Set<string>();

  for (const row of value.slice(0, MAX_FOLLOWED_IDS)) {
    if (!row || typeof row !== "object") {
      return null;
    }

    const record = row as { id?: unknown; label?: unknown };
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (!ID_PATTERN.test(id) || !label || label.length > 120) {
      return null;
    }

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    refs.push({ id, label });
  }

  return refs;
}

function parsePostalCode(value: unknown) {
  if (value === undefined || value === null) {
    return { ok: true as const, postalCode: "" };
  }

  if (typeof value !== "string") {
    return { ok: false as const };
  }

  const postalCode = value.trim().toUpperCase();
  if (!postalCode) {
    return { ok: true as const, postalCode: "" };
  }

  if (!/^[A-Z0-9][A-Z0-9\s-]{1,11}$/.test(postalCode)) {
    return { ok: false as const };
  }

  return { ok: true as const, postalCode };
}

export function parseUpcomingShowsRequest(body: unknown) {
  if (!body || typeof body !== "object") {
    return {
      ok: false as const,
      status: 400,
      message: "Follow an artist or venue first.",
    };
  }

  const record = body as {
    attractions?: unknown;
    venues?: unknown;
    postalCode?: unknown;
  };

  const attractions = parseFollowedRefs(record.attractions);
  const venues = parseFollowedRefs(record.venues);
  const postal = parsePostalCode(record.postalCode);
  if (!attractions || !venues || !postal.ok) {
    return {
      ok: false as const,
      status: 400,
      message: "That search could not be used. Try again.",
    };
  }

  if (attractions.length === 0 && venues.length === 0) {
    return {
      ok: false as const,
      status: 400,
      message: "Follow an artist or venue first.",
    };
  }

  return {
    ok: true as const,
    attractions,
    venues,
    postalCode: postal.postalCode,
  };
}

function startDateTimeNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function formatDateLabel(localDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return localDate;
  }

  return new Date(`${localDate}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function formatTimeLabel(localTime: string) {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(localTime)) {
    return "";
  }

  const [hours, minutes] = localTime.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function eventRows(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const embedded = (payload as { _embedded?: { events?: unknown } })._embedded;
  return Array.isArray(embedded?.events)
    ? embedded.events.filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === "object",
      )
    : [];
}

function relatedRows(event: Record<string, unknown>, key: "attractions" | "venues") {
  const embedded = event._embedded;
  if (!embedded || typeof embedded !== "object") {
    return [];
  }

  const record = embedded as { attractions?: unknown; venues?: unknown; venue?: unknown };
  const rows =
    key === "venues"
      ? record.venues ?? record.venue
      : record.attractions;
  return Array.isArray(rows) ? rows : [];
}

function relatedIds(event: Record<string, unknown>, key: "attractions" | "venues") {
  return relatedRows(event, key)
    .map((row) =>
      row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string"
        ? String((row as { id: string }).id)
        : "",
    )
    .filter(Boolean);
}

function firstVenue(event: Record<string, unknown>) {
  const rows = relatedRows(event, "venues");
  const row = rows[0];
  if (!row || typeof row !== "object") {
    return { name: "", city: "", state: "" };
  }

  const record = row as { name?: unknown; city?: unknown; state?: unknown };
  return {
    name: typeof record.name === "string" ? record.name.trim() : "",
    city: readName(record.city),
    state: readState(record.state),
  };
}

function eventSortKey(event: Record<string, unknown>) {
  const dates = event.dates;
  if (!dates || typeof dates !== "object") {
    return "";
  }

  const start = (dates as { start?: unknown }).start;
  if (!start || typeof start !== "object") {
    return "";
  }

  const record = start as {
    dateTime?: unknown;
    localDate?: unknown;
    localTime?: unknown;
    dateTBA?: unknown;
    dateTBD?: unknown;
  };

  if (record.dateTBA === true || record.dateTBD === true) {
    return "";
  }

  if (typeof record.dateTime === "string" && record.dateTime) {
    return record.dateTime;
  }

  if (typeof record.localDate === "string" && record.localDate) {
    const time =
      typeof record.localTime === "string" && record.localTime
        ? record.localTime
        : "23:59:59";
    return `${record.localDate}T${time}`;
  }

  return "";
}

function isUpcomingEvent(event: Record<string, unknown>) {
  const dates = event.dates;
  if (!dates || typeof dates !== "object") {
    return false;
  }

  const start = (dates as { start?: unknown }).start;
  if (!start || typeof start !== "object") {
    return false;
  }

  const record = start as {
    dateTime?: unknown;
    localDate?: unknown;
    dateTBA?: unknown;
    dateTBD?: unknown;
  };

  if (record.dateTBA === true || record.dateTBD === true) {
    return false;
  }

  if (typeof record.dateTime === "string" && record.dateTime) {
    const time = Date.parse(record.dateTime);
    return !Number.isNaN(time) && time >= Date.now();
  }

  if (typeof record.localDate === "string" && record.localDate) {
    return record.localDate >= todayStamp();
  }

  return false;
}

function mapShow(
  event: Record<string, unknown>,
  matchedLabels: string[],
): TicketmasterShow | null {
  const id = typeof event.id === "string" ? event.id.trim() : "";
  const name = typeof event.name === "string" ? event.name.trim() : "";
  if (!id || !name || matchedLabels.length === 0) {
    return null;
  }

  const dates = event.dates;
  const start =
    dates && typeof dates === "object"
      ? (dates as { start?: unknown }).start
      : null;
  const startRecord =
    start && typeof start === "object"
      ? (start as { localDate?: unknown; localTime?: unknown })
      : {};
  const localDate =
    typeof startRecord.localDate === "string" ? startRecord.localDate : "";
  const localTime =
    typeof startRecord.localTime === "string" ? startRecord.localTime : "";
  const venue = firstVenue(event);
  const show: TicketmasterShow = {
    id,
    name,
    dateLabel: localDate ? formatDateLabel(localDate) : "Date TBA",
    venueName: venue.name,
    city: venue.city,
    state: venue.state,
    matchedLabels,
  };

  const timeLabel = localTime ? formatTimeLabel(localTime) : "";
  if (timeLabel) {
    show.timeLabel = timeLabel;
  }

  const url = typeof event.url === "string" ? event.url.trim() : "";
  if (isHttpUrl(url)) {
    show.url = url;
  }

  const image = pickImage(event.images);
  if (image) {
    show.image = image;
  }

  return show;
}

function mergeShows(
  batches: { source: "attraction" | "venue"; payload: unknown }[],
  attractions: FollowedRef[],
  venues: FollowedRef[],
) {
  const attractionMap = new Map(attractions.map((item) => [item.id, item.label]));
  const venueMap = new Map(venues.map((item) => [item.id, item.label]));
  const shows = new Map<string, TicketmasterShow & { sortAt: string }>();

  for (const batch of batches) {
    for (const event of eventRows(batch.payload)) {
      if (!isUpcomingEvent(event)) {
        continue;
      }

      const labels = new Set<string>();
      for (const id of relatedIds(event, "attractions")) {
        const label = attractionMap.get(id);
        if (label) {
          labels.add(label);
        }
      }
      for (const id of relatedIds(event, "venues")) {
        const label = venueMap.get(id);
        if (label) {
          labels.add(label);
        }
      }

      if (labels.size === 0) {
        if (batch.source === "attraction" && attractions.length === 1) {
          labels.add(attractions[0].label);
        } else if (batch.source === "venue" && venues.length === 1) {
          labels.add(venues[0].label);
        }
      }

      const matchedLabels = [...labels];
      if (matchedLabels.length === 0) {
        continue;
      }

      const show = mapShow(event, matchedLabels);
      if (!show) {
        continue;
      }

      const sortAt = eventSortKey(event);
      const existing = shows.get(show.id);
      if (existing) {
        existing.matchedLabels = [
          ...new Set([...existing.matchedLabels, ...show.matchedLabels]),
        ];
        continue;
      }

      shows.set(show.id, { ...show, sortAt });
    }
  }

  return [...shows.values()]
    .sort((a, b) => a.sortAt.localeCompare(b.sortAt))
    .map(({ sortAt: _sortAt, ...show }) => show);
}

export async function searchUpcomingShows(input: {
  attractions: FollowedRef[];
  venues: FollowedRef[];
  postalCode: string;
}): Promise<UpcomingShowsResult> {
  const startDateTime = startDateTimeNow();
  const requests: Promise<{ ok: true; payload: unknown } | TicketmasterFailure>[] =
    [];

  if (input.attractions.length > 0) {
    const params: Record<string, string> = {
      attractionId: input.attractions.map((item) => item.id).join(","),
      size: String(EVENT_PAGE_SIZE),
      sort: "date,asc",
      startDateTime,
    };
    if (input.postalCode) {
      params.postalCode = input.postalCode;
    }
    requests.push(ticketmasterGet(EVENTS_PATH, params));
  }

  if (input.venues.length > 0) {
    requests.push(
      ticketmasterGet(EVENTS_PATH, {
        venueId: input.venues.map((item) => item.id).join(","),
        size: String(EVENT_PAGE_SIZE),
        sort: "date,asc",
        startDateTime,
      }),
    );
  }

  const results = await Promise.all(requests);
  const batches: { source: "attraction" | "venue"; payload: unknown }[] = [];
  const sources: ("attraction" | "venue")[] = [];
  if (input.attractions.length > 0) {
    sources.push("attraction");
  }
  if (input.venues.length > 0) {
    sources.push("venue");
  }

  for (const [index, result] of results.entries()) {
    if (!result.ok) {
      return result;
    }
    batches.push({ source: sources[index], payload: result.payload });
  }

  return {
    ok: true,
    shows: mergeShows(batches, input.attractions, input.venues),
  };
}

export type FollowedEventIdsResult =
  | { ok: true; ids: string[] }
  | TicketmasterFailure;

export async function searchFollowedEventIds(input: {
  itemType: "ticketmaster_attraction" | "ticketmaster_venue";
  itemKey: string;
}): Promise<FollowedEventIdsResult> {
  const params: Record<string, string> = {
    size: String(EVENT_PAGE_SIZE),
    sort: "date,asc",
    startDateTime: startDateTimeNow(),
  };

  if (input.itemType === "ticketmaster_attraction") {
    params.attractionId = input.itemKey;
  } else {
    params.venueId = input.itemKey;
  }

  const result = await ticketmasterGet(EVENTS_PATH, params);
  if (!result.ok) {
    return result;
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const event of eventRows(result.payload)) {
    if (!isUpcomingEvent(event)) {
      continue;
    }
    const id = typeof event.id === "string" ? event.id.trim() : "";
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return { ok: true, ids };
}

const MAX_DETAIL_IDS = 8;

export function parseEventDetailIds(value: string | null) {
  const ids = (value ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => ID_PATTERN.test(id));
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
    if (unique.length >= MAX_DETAIL_IDS) {
      break;
    }
  }
  if (unique.length === 0) {
    return {
      ok: false as const,
      status: 400,
      message: "Choose a show to look up.",
    };
  }
  return { ok: true as const, ids: unique };
}

function attractionNames(event: Record<string, unknown>) {
  return relatedRows(event, "attractions")
    .map((row) =>
      row && typeof row === "object" && typeof (row as { name?: unknown }).name === "string"
        ? String((row as { name: string }).name).trim()
        : "",
    )
    .filter(Boolean);
}

function asEventRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.id === "string") {
    return record;
  }
  return eventRows(payload)[0] ?? null;
}

export async function lookupEventsByIds(
  ids: string[],
): Promise<UpcomingShowsResult> {
  const shows: TicketmasterShow[] = [];

  for (const id of ids) {
    const result = await ticketmasterGet(`${EVENTS_PATH.replace(".json", "")}/${id}.json`, {});
    if (!result.ok) {
      if (result.status === 429) {
        return result;
      }
      continue;
    }

    const event = asEventRecord(result.payload);
    if (!event) {
      continue;
    }
    const labels = attractionNames(event);
    const show = mapShow(event, labels.length > 0 ? labels : ["New show"]);
    if (show) {
      shows.push(show);
    }
  }

  return { ok: true, shows };
}
