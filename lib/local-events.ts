import type { ConcertEvent, EventSearchRequest } from "../shared/api/v1";
import { distanceMiles, resolveSearchOrigin } from "./geo.ts";
import { getSupabaseAdminClient } from "./supabase/admin-client.ts";

export type LocalEventRow = {
  id: string;
  artist: string;
  venue: string | null;
  city: string | null;
  event_date: string | null;
  description: string | null;
  created_at: string;
  is_published: boolean;
  source_name?: string | null;
  source_url?: string | null;
  source_updated_at?: string | null;
  ticket_url?: string | null;
  image_url?: string | null;
  external_id?: string | null;
  venue_address_line?: string | null;
  state?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
};

const LEGACY_SELECT =
  "id, artist, venue, city, event_date, description, created_at, is_published";
const SOURCE_SELECT = `${LEGACY_SELECT}, source_name, source_url, source_updated_at, ticket_url, image_url, external_id, venue_address_line, state, postal_code, latitude, longitude, timezone`;

function clean(value: string | null | undefined) {
  return value?.trim() || null;
}

function validUrl(value: string | null | undefined) {
  const text = clean(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? text : null;
  } catch {
    return null;
  }
}

function localDateParts(value: string, timezone: string | null) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", {
      ...options,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(parsed);
  const dateParts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timezone ? { timeZone: timezone } : {}),
  }).formatToParts(parsed);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((item) => item.type === type)?.value ?? "";
  const localDate = `${part("year")}-${part("month")}-${part("day")}`;
  return {
    startsAt: parsed.toISOString(),
    localDate,
    localTime: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(parsed),
    dateLabel: format({ weekday: "short", month: "short", day: "numeric" }),
    timeLabel: format({ hour: "numeric", minute: "2-digit" }),
  };
}

export function mapLocalEvent(row: LocalEventRow): ConcertEvent | null {
  const artist = clean(row.artist);
  const date = row.event_date ? localDateParts(row.event_date, clean(row.timezone)) : null;
  if (!artist || !date || row.is_published !== true) return null;

  const sourceName = clean(row.source_name) ?? "Community listing";
  const sourceId = sourceName.toLowerCase().includes("local buzz")
    ? "local-buzz-757"
    : "community";
  const venueName = clean(row.venue) ?? "Venue TBA";
  const city = clean(row.city);
  const state = clean(row.state);
  const externalId = clean(row.external_id);

  return {
    id: externalId ? `${sourceId}:${externalId}` : `${sourceId}:${row.id}`,
    name: artist,
    startsAt: date.startsAt,
    localDate: date.localDate,
    localTime: date.localTime,
    doorTime: null,
    timezone: clean(row.timezone),
    dateStatus: "scheduled",
    dateLabel: date.dateLabel,
    timeLabel: date.timeLabel,
    status: "scheduled",
    ticketUrl: validUrl(row.ticket_url) ?? validUrl(row.source_url),
    imageUrl: validUrl(row.image_url),
    venue: {
      id: `${sourceId}:venue:${normalizeText(venueName) || row.id}`,
      name: venueName,
      addressLine: clean(row.venue_address_line),
      city,
      state,
      stateCode: state,
      postalCode: clean(row.postal_code),
      countryCode: "US",
      timezone: clean(row.timezone),
      latitude: typeof row.latitude === "number" ? row.latitude : null,
      longitude: typeof row.longitude === "number" ? row.longitude : null,
    },
    attractions: [
      {
        id: `${sourceId}:artist:${normalizeText(artist)}`,
        name: artist,
        imageUrl: validUrl(row.image_url),
      },
    ],
    matchedLabels: [],
    sales: null,
    price: null,
    source: {
      id: sourceId,
      label: sourceName,
      url: validUrl(row.source_url),
      updatedAt: clean(row.source_updated_at) ?? clean(row.created_at),
    },
  };
}

export function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(the|live|in concert)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function eventIdentity(event: ConcertEvent) {
  const artist = event.attractions[0]?.name || event.name;
  return [
    normalizeText(artist),
    event.localDate ?? "",
    normalizeText(event.venue.name),
    normalizeText(event.venue.city ?? ""),
  ].join("|");
}

export function mergeEventSources(
  primary: ConcertEvent[],
  local: ConcertEvent[],
) {
  const seen = new Set(primary.map(eventIdentity));
  const merged = [...primary];
  for (const event of local) {
    const identity = eventIdentity(event);
    if (!seen.has(identity)) {
      seen.add(identity);
      merged.push(event);
    }
  }
  return merged.sort((a, b) => {
    const left = a.startsAt ?? `${a.localDate ?? "9999-12-31"}T23:59:59`;
    const right = b.startsAt ?? `${b.localDate ?? "9999-12-31"}T23:59:59`;
    return left.localeCompare(right);
  });
}

function eventMatchesText(event: ConcertEvent, values: string[]) {
  const haystack = normalizeText(
    [event.name, event.venue.name, event.venue.city, ...event.attractions.map((a) => a.name)]
      .filter(Boolean)
      .join(" "),
  );
  return values.some((value) => {
    const needle = normalizeText(value);
    return needle.length > 0 && haystack.includes(needle);
  });
}

export async function filterLocalEventsForSearch(
  events: ConcertEvent[],
  input: Required<Pick<EventSearchRequest, "attractions" | "venues">> &
    Pick<EventSearchRequest, "keyword" | "location" | "endDateTime">,
) {
  const origin = input.location
    ? await resolveSearchOrigin({
        postalCode: input.location.postalCode ?? "",
        latitude: input.location.latitude ?? null,
        longitude: input.location.longitude ?? null,
        radiusMiles: input.location.radiusMiles ?? 50,
      })
    : null;
  const labels = [
    ...input.attractions.map((item) => item.label),
    ...input.venues.map((item) => item.label),
    ...(input.keyword ? [input.keyword] : []),
  ];
  const requestedPostal = input.location?.postalCode?.replace(/\D/g, "").slice(0, 5);

  return events.filter((event) => {
    if (input.endDateTime && event.startsAt && event.startsAt > input.endDateTime) return false;
    if (labels.length > 0 && !eventMatchesText(event, labels)) return false;
    if (!input.location) return true;
    const latitude = event.venue.latitude;
    const longitude = event.venue.longitude;
    if (origin && latitude !== null && longitude !== null) {
      return distanceMiles(origin, { latitude, longitude }) <= origin.radiusMiles;
    }
    const eventPostal = event.venue.postalCode?.replace(/\D/g, "").slice(0, 5);
    return Boolean(requestedPostal && eventPostal === requestedPostal);
  });
}

export async function loadPublishedLocalEvents() {
  const supabase = getSupabaseAdminClient();
  const query = (select: string) =>
    supabase
      .from("concerts")
      .select(select)
      .eq("is_published", true)
      .gte("event_date", new Date().toISOString())
      .order("event_date", { ascending: true })
      .limit(250);

  let result = await query(SOURCE_SELECT);
  if (result.error) result = await query(LEGACY_SELECT);
  if (result.error) throw result.error;
  return (result.data ?? []).flatMap((row) => {
    const event = mapLocalEvent(row as unknown as LocalEventRow);
    return event ? [event] : [];
  });
}
