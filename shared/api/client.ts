import type {
  ApiFailure,
  ApiSuccess,
  ArtistSearchData,
  EventDetailsData,
  EventSearchData,
  EventSearchRequest,
  MergeAnonymousData,
  VenueSearchData,
} from "./v1";

type FetchLike = typeof fetch;

export class ConcertFinderApiError extends Error {
  readonly status: number;
  readonly code: ApiFailure["error"]["code"];

  constructor(status: number, failure: ApiFailure) {
    super(failure.error.message);
    this.name = "ConcertFinderApiError";
    this.status = status;
    this.code = failure.error.code;
  }
}

function apiUrl(baseUrl: string, path: string) {
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in payload) {
    const failure: ApiFailure =
      "error" in payload
        ? payload
        : {
            apiVersion: "v1",
            error: {
              code: "upstream_error",
              message: "The Concert Finder service could not complete that request.",
            },
            meta: { requestId: "unknown" },
          };
    throw new ConcertFinderApiError(response.status, failure);
  }
  return payload.data;
}

export function createConcertFinderApiClient(options?: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}) {
  const baseUrl = options?.baseUrl?.trim() ?? "";
  const fetchImpl = options?.fetchImpl ?? fetch;

  return {
    async searchArtists(keyword: string, signal?: AbortSignal) {
      const params = new URLSearchParams({ keyword });
      const response = await fetchImpl(
        apiUrl(baseUrl, `/api/v1/ticketmaster/attractions?${params}`),
        { signal },
      );
      return readJson<ArtistSearchData>(response);
    },

    async searchVenues(keyword: string, signal?: AbortSignal) {
      const params = new URLSearchParams({ keyword });
      const response = await fetchImpl(
        apiUrl(baseUrl, `/api/v1/ticketmaster/venues?${params}`),
        { signal },
      );
      return readJson<VenueSearchData>(response);
    },

    async searchEvents(body: EventSearchRequest, signal?: AbortSignal) {
      const response = await fetchImpl(
        apiUrl(baseUrl, "/api/v1/ticketmaster/events"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify(body),
        },
      );
      return readJson<EventSearchData>(response);
    },

    async eventDetails(ids: string[], signal?: AbortSignal) {
      const params = new URLSearchParams({ ids: ids.join(",") });
      const response = await fetchImpl(
        apiUrl(baseUrl, `/api/v1/ticketmaster/event-details?${params}`),
        { signal },
      );
      return readJson<EventDetailsData>(response);
    },

    async mergeAnonymousAccount(
      currentAccessToken: string,
      previousAccessToken: string,
      signal?: AbortSignal,
    ) {
      const response = await fetchImpl(
        apiUrl(baseUrl, "/api/v1/account/merge-anonymous"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAccessToken}`,
            "Content-Type": "application/json",
          },
          signal,
          body: JSON.stringify({ previousAccessToken }),
        },
      );
      return readJson<MergeAnonymousData>(response);
    },
  };
}
