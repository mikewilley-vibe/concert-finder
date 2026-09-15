export const INTERACTION_SIGNALS_STORAGE_KEY =
  "showsignal:v1:interaction-signals";

export type InteractionKind =
  | "view"
  | "tap"
  | "save"
  | "unsave"
  | "ticket"
  | "share"
  | "attendance";

export type AttendanceSignalStatus = "interested" | "going" | null;

export type EventSignals = {
  views: number;
  taps: number;
  saves: number;
  ticketOpens: number;
  shares: number;
  interested: number;
  going: number;
  lastAt: number;
};

export type EntitySignals = {
  taps: number;
  saves: number;
  ticketOpens: number;
  shares: number;
  interested: number;
  going: number;
  lastAt: number;
};

export type InteractionSignals = {
  events: Record<string, EventSignals>;
  artists: Record<string, EntitySignals>;
  venues: Record<string, EntitySignals>;
  genres: Record<string, EntitySignals>;
};

export const EMPTY_INTERACTION_SIGNALS: InteractionSignals = {
  events: {},
  artists: {},
  venues: {},
  genres: {},
};

const EMPTY_EVENT: EventSignals = {
  views: 0,
  taps: 0,
  saves: 0,
  ticketOpens: 0,
  shares: 0,
  interested: 0,
  going: 0,
  lastAt: 0,
};

const EMPTY_ENTITY: EntitySignals = {
  taps: 0,
  saves: 0,
  ticketOpens: 0,
  shares: 0,
  interested: 0,
  going: 0,
  lastAt: 0,
};

function asCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function parseEventSignals(value: unknown): EventSignals | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  return {
    views: asCount(record.views),
    taps: asCount(record.taps),
    saves: asCount(record.saves),
    ticketOpens: asCount(record.ticketOpens),
    shares: asCount(record.shares),
    interested: asCount(record.interested),
    going: asCount(record.going),
    lastAt: asCount(record.lastAt),
  };
}

function parseEntitySignals(value: unknown): EntitySignals | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  return {
    taps: asCount(record.taps),
    saves: asCount(record.saves),
    ticketOpens: asCount(record.ticketOpens),
    shares: asCount(record.shares),
    interested: asCount(record.interested),
    going: asCount(record.going),
    lastAt: asCount(record.lastAt),
  };
}

function parseBucket<T>(
  value: unknown,
  parseRow: (row: unknown) => T | null,
): Record<string, T> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const next: Record<string, T> = {};
  for (const [key, row] of Object.entries(value as Record<string, unknown>)) {
    const parsed = parseRow(row);
    if (parsed) {
      next[key] = parsed;
    }
  }
  return next;
}

export function parseInteractionSignals(raw: string | null): InteractionSignals {
  if (!raw) {
    return { events: {}, artists: {}, venues: {}, genres: {} };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { events: {}, artists: {}, venues: {}, genres: {} };
    }
    const record = parsed as {
      events?: unknown;
      artists?: unknown;
      venues?: unknown;
      genres?: unknown;
    };
    return {
      events: parseBucket(record.events, parseEventSignals),
      artists: parseBucket(record.artists, parseEntitySignals),
      venues: parseBucket(record.venues, parseEntitySignals),
      genres: parseBucket(record.genres, parseEntitySignals),
    };
  } catch {
    return { events: {}, artists: {}, venues: {}, genres: {} };
  }
}

export function emptyEventSignals(): EventSignals {
  return { ...EMPTY_EVENT };
}

export function eventSignalsFor(
  signals: InteractionSignals,
  eventId: string,
): EventSignals {
  return signals.events[eventId] ?? EMPTY_EVENT;
}

function applyAttendanceCounts(
  row: { interested: number; going: number },
  fromStatus: AttendanceSignalStatus,
  toStatus: AttendanceSignalStatus,
) {
  if (fromStatus === toStatus) {
    return;
  }
  if (fromStatus === "interested") {
    row.interested = Math.max(0, row.interested - 1);
  }
  if (fromStatus === "going") {
    row.going = Math.max(0, row.going - 1);
  }
  if (toStatus === "interested") {
    row.interested += 1;
  }
  if (toStatus === "going") {
    row.going += 1;
  }
}

/**
 * Lightweight inferred score. Explicit favorites must always outrank this.
 * Keep the range well below favorite-artist / favorite-venue weights.
 * Going is a very strong preference; Interested is strong.
 */
export function engagementScore(signals: EventSignals | undefined) {
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

export function applyInteraction(
  current: InteractionSignals,
  input: {
    kind: InteractionKind;
    eventId: string;
    artistIds?: readonly string[];
    venueId?: string | null;
    genreIds?: readonly string[];
    at?: number;
    fromStatus?: AttendanceSignalStatus;
    toStatus?: AttendanceSignalStatus;
  },
): InteractionSignals {
  const at = input.at ?? Date.now();
  const eventId = input.eventId.trim();
  if (!eventId) {
    return current;
  }

  const events = { ...current.events };
  const event = { ...(events[eventId] ?? EMPTY_EVENT) };
  if (input.kind === "view") event.views += 1;
  if (input.kind === "tap") event.taps += 1;
  if (input.kind === "save") event.saves += 1;
  if (input.kind === "unsave") event.saves = Math.max(0, event.saves - 1);
  if (input.kind === "ticket") event.ticketOpens += 1;
  if (input.kind === "share") event.shares += 1;
  if (input.kind === "attendance") {
    applyAttendanceCounts(event, input.fromStatus ?? null, input.toStatus ?? null);
  }
  event.lastAt = at;
  events[eventId] = event;

  const bumpEntity = (
    bucket: Record<string, EntitySignals>,
    id: string,
  ): Record<string, EntitySignals> => {
    const key = id.trim();
    if (!key || input.kind === "view") {
      return bucket;
    }
    const row = { ...(bucket[key] ?? EMPTY_ENTITY) };
    if (input.kind === "tap") row.taps += 1;
    if (input.kind === "save") row.saves += 1;
    if (input.kind === "unsave") row.saves = Math.max(0, row.saves - 1);
    if (input.kind === "ticket") row.ticketOpens += 1;
    if (input.kind === "share") row.shares += 1;
    if (input.kind === "attendance") {
      applyAttendanceCounts(row, input.fromStatus ?? null, input.toStatus ?? null);
    }
    row.lastAt = at;
    return { ...bucket, [key]: row };
  };

  let artists = current.artists;
  for (const id of input.artistIds ?? []) {
    artists = bumpEntity(artists, id);
  }
  let venues = current.venues;
  if (input.venueId) {
    venues = bumpEntity(venues, input.venueId);
  }
  let genres = current.genres;
  for (const id of input.genreIds ?? []) {
    genres = bumpEntity(genres, id);
  }

  return { events, artists, venues, genres };
}
