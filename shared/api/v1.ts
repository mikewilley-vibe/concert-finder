export const API_VERSION = "v1" as const;
export const EVENT_SEARCH_FOLLOW_LIMIT = 25;

export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "rate_limited"
  | "unauthorized"
  | "forbidden"
  | "not_configured"
  | "upstream_error"
  | "internal_error";

export type ApiMeta = {
  requestId: string;
};

export type ApiSuccess<T> = {
  apiVersion: typeof API_VERSION;
  data: T;
  meta: ApiMeta;
};

export type ApiFailure = {
  apiVersion: typeof API_VERSION;
  error: {
    code: ApiErrorCode;
    message: string;
  };
  meta: ApiMeta;
};

export type ArtistSummary = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type VenueSummary = {
  id: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  postalCode: string | null;
  countryCode: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type EventDateStatus = "scheduled" | "date_tba" | "date_tbd";

export type SaleWindow = {
  startsAt: string | null;
  endsAt: string | null;
};

export type ConcertEvent = {
  id: string;
  name: string;
  startsAt: string | null;
  localDate: string | null;
  localTime: string | null;
  timezone: string | null;
  dateStatus: EventDateStatus;
  dateLabel: string;
  timeLabel: string | null;
  status: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  venue: VenueSummary;
  attractions: ArtistSummary[];
  matchedLabels: string[];
  sales: SaleWindow | null;
};

export type FollowedReference = {
  id: string;
  label: string;
};

export type EventSearchLocation = {
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  radiusMiles?: number;
};

export type EventSearchRequest = {
  attractions?: FollowedReference[];
  venues?: FollowedReference[];
  keyword?: string;
  location?: EventSearchLocation;
  page?: number;
  pageSize?: number;
};

export type EventSearchPage = {
  page: number;
  pageSize: number;
  resultCount: number;
  hasMore: boolean;
  nextPage: number | null;
};

export type ArtistSearchData = {
  artists: ArtistSummary[];
  suggestions: ArtistSummary[];
};

export type VenueSearchData = {
  venues: VenueSummary[];
};

export type EventSearchData = {
  events: ConcertEvent[];
  page: EventSearchPage;
};

export type EventDetailsData = {
  events: ConcertEvent[];
};

export type MergeAnonymousData = {
  merged: true;
};
