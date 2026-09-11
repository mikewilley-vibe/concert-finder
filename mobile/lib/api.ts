import { getApiBaseUrl } from "./config";

export type TicketmasterAttraction = {
  id: string;
  name: string;
  image?: string;
  genreId?: string;
  genreName?: string;
  subGenreId?: string;
  subGenreName?: string;
};

export type TicketmasterVenue = {
  id: string;
  name: string;
  city?: string;
  state?: string;
};

export type TicketmasterArtistRef = {
  id: string;
  name: string;
  image?: string;
};

export type TicketmasterShow = {
  id: string;
  name: string;
  dateLabel: string;
  timeLabel?: string;
  localDate?: string;
  localTime?: string;
  startsAt?: string;
  venueName: string;
  city: string;
  state: string;
  url?: string;
  image?: string;
  attractions: TicketmasterArtistRef[];
  matchedLabels: string[];
};

export type FollowedRef = {
  id: string;
  label: string;
};

type NativeApiShow = {
  id: string;
  name: string;
  dateLabel: string;
  timeLabel: string | null;
  localDate: string | null;
  localTime: string | null;
  startsAt: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  attractions: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
  }>;
  matchedLabels: string[];
  venue: {
    name: string;
    city: string | null;
    stateCode: string | null;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = "unknown") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type JsonRecord = Record<string, unknown>;

function apiUrl(path: string) {
  return new URL(path, `${getApiBaseUrl()}/`);
}

async function readJson(response: Response): Promise<JsonRecord> {
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object") {
      return payload as JsonRecord;
    }
  } catch {
    // Fall through to a generic error below.
  }

  return {};
}

function errorMessage(payload: JsonRecord, fallback: string) {
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }
  if (
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return fallback;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
  });
  const payload = await readJson(response);

  if (!response.ok) {
    const error =
      payload.error && typeof payload.error === "object"
        ? (payload.error as JsonRecord)
        : {};
    throw new ApiError(
      errorMessage(payload, "That request could not be completed."),
      response.status,
      typeof error.code === "string" ? error.code : "unknown",
    );
  }

  return ("data" in payload ? payload.data : payload) as T;
}

function mapArtist(artist: {
  id: string;
  name: string;
  imageUrl: string | null;
  genreId?: string | null;
  genreName?: string | null;
  subGenreId?: string | null;
  subGenreName?: string | null;
}): TicketmasterAttraction {
  return {
    id: artist.id,
    name: artist.name,
    image: artist.imageUrl ?? undefined,
    genreId: artist.genreId ?? undefined,
    genreName: artist.genreName ?? undefined,
    subGenreId: artist.subGenreId ?? undefined,
    subGenreName: artist.subGenreName ?? undefined,
  };
}

export function searchAttractions(keyword: string) {
  const params = new URLSearchParams({ keyword });
  return apiFetch<{
    artists: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      genreId?: string | null;
      genreName?: string | null;
      subGenreId?: string | null;
      subGenreName?: string | null;
    }>;
    suggestions: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      genreId?: string | null;
      genreName?: string | null;
      subGenreId?: string | null;
      subGenreName?: string | null;
    }>;
  }>(`/api/v1/ticketmaster/attractions?${params}`).then((result) => ({
    attractions: result.artists.map(mapArtist),
    suggestions: result.suggestions.map(mapArtist),
  }));
}

export function searchVenues(keyword: string) {
  const params = new URLSearchParams({ keyword });
  return apiFetch<{
    venues: Array<{
      id: string;
      name: string;
      city: string | null;
      stateCode: string | null;
    }>;
  }>(`/api/v1/ticketmaster/venues?${params}`).then((result) => ({
    venues: result.venues.map((venue) => ({
      id: venue.id,
      name: venue.name,
      city: venue.city ?? undefined,
      state: venue.stateCode ?? undefined,
    })),
  }));
}

export function searchUpcomingShows(input: {
  attractions: FollowedRef[];
  venues: FollowedRef[];
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
}) {
  const postalCode = input.postalCode?.trim();
  const hasCoords =
    typeof input.latitude === "number" &&
    typeof input.longitude === "number" &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude);
  const location = hasCoords
    ? {
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMiles: input.radiusMiles,
      }
    : postalCode
      ? {
          postalCode,
          radiusMiles: input.radiusMiles,
        }
      : undefined;
  return apiFetch<{ events: NativeApiShow[] }>(
    "/api/v1/ticketmaster/events",
    {
      method: "POST",
      body: JSON.stringify({
        attractions: input.attractions,
        venues: input.venues,
        location,
      }),
    },
  ).then((result) => ({ shows: result.events.map(mapShow) }));
}

export function getEventDetails(ids: string[]) {
  const params = new URLSearchParams({ ids: ids.join(",") });
  return apiFetch<{ events: NativeApiShow[] }>(
    `/api/v1/ticketmaster/event-details?${params}`,
  ).then((result) => ({ shows: result.events.map(mapShow) }));
}

function mapShow(show: NativeApiShow): TicketmasterShow {
  return {
    id: show.id,
    name: show.name,
    dateLabel: show.dateLabel,
    timeLabel: show.timeLabel ?? undefined,
    localDate: show.localDate ?? undefined,
    localTime: show.localTime ?? undefined,
    startsAt: show.startsAt ?? undefined,
    venueName: show.venue.name,
    city: show.venue.city ?? "",
    state: show.venue.stateCode ?? "",
    url: show.ticketUrl ?? undefined,
    image: show.imageUrl ?? undefined,
    attractions: show.attractions.map((artist) => ({
      id: artist.id,
      name: artist.name,
      image: artist.imageUrl ?? undefined,
    })),
    matchedLabels: show.matchedLabels,
  };
}

export function mergeAnonymousAccount(options: {
  currentAccessToken: string;
  previousAccessToken: string;
}) {
  return apiFetch<{ merged: boolean }>("/api/v1/account/merge-anonymous", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.currentAccessToken}`,
    },
    body: JSON.stringify({
      previousAccessToken: options.previousAccessToken,
    }),
  });
}

export async function deleteAccount(accessToken: string) {
  const init = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Confirm-Account-Delete": "DELETE",
    },
    body: JSON.stringify({ confirmation: "DELETE" }),
  };

  try {
    return await apiFetch<{ deleted: true }>("/api/v1/account/delete", {
      method: "POST",
      ...init,
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 405)
    ) {
      return apiFetch<{ deleted: true }>("/api/v1/account/delete", {
        method: "DELETE",
        ...init,
      });
    }
    throw error;
  }
}

export function searchRecommendations(input: {
  seeds: Array<{
    id: string;
    label: string;
    genreId?: string | null;
    genreName?: string | null;
    subGenreId?: string | null;
    subGenreName?: string | null;
  }>;
  excludeAttractionIds: string[];
  excludeVenueIds: string[];
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
}) {
  const postalCode = input.postalCode?.trim();
  const hasCoords =
    typeof input.latitude === "number" &&
    typeof input.longitude === "number" &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude);
  const location = hasCoords
    ? {
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMiles: input.radiusMiles,
      }
    : postalCode
      ? {
          postalCode,
          radiusMiles: input.radiusMiles,
        }
      : undefined;
  return apiFetch<{
    seedLabel: string | null;
    artists: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      reason: string;
    }>;
    venues: Array<{
      id: string;
      name: string;
      city: string | null;
      state: string | null;
      reason: string;
    }>;
  }>("/api/v1/ticketmaster/recommendations", {
    method: "POST",
    body: JSON.stringify({
      seeds: input.seeds,
      excludeAttractionIds: input.excludeAttractionIds,
      excludeVenueIds: input.excludeVenueIds,
      location,
    }),
  });
}

export function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return "Too many Ticketmaster searches. Wait a moment and try again.";
    }
    if (error.status === 401 || error.status === 500) {
      return error.message || "Search is not configured on the server yet.";
    }
    return error.message || fallback;
  }

  return fallback;
}
