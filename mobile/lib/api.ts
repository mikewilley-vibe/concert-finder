import { getApiBaseUrl } from "./config";

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

export type FollowedRef = {
  id: string;
  label: string;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
  return typeof payload.error === "string" && payload.error.trim()
    ? payload.error
    : fallback;
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
    throw new ApiError(
      errorMessage(payload, "That request could not be completed."),
      response.status,
    );
  }

  return payload as T;
}

export function searchAttractions(keyword: string) {
  const params = new URLSearchParams({ keyword });
  return apiFetch<{
    attractions: TicketmasterAttraction[];
    suggestions: TicketmasterAttraction[];
  }>(`/api/ticketmaster/attractions?${params}`);
}

export function searchVenues(keyword: string) {
  const params = new URLSearchParams({ keyword });
  return apiFetch<{ venues: TicketmasterVenue[] }>(
    `/api/ticketmaster/venues?${params}`,
  );
}

export function searchUpcomingShows(input: {
  attractions: FollowedRef[];
  venues: FollowedRef[];
  postalCode?: string;
}) {
  return apiFetch<{ shows: TicketmasterShow[] }>("/api/ticketmaster/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getEventDetails(ids: string[]) {
  const params = new URLSearchParams({ ids: ids.join(",") });
  return apiFetch<{ shows: TicketmasterShow[] }>(
    `/api/ticketmaster/event-details?${params}`,
  );
}

export function mergeAnonymousAccount(options: {
  currentAccessToken: string;
  previousAccessToken: string;
}) {
  return apiFetch<{ merged: boolean }>("/api/account/merge-anonymous", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.currentAccessToken}`,
    },
    body: JSON.stringify({
      previousAccessToken: options.previousAccessToken,
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
