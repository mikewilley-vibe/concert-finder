import { NextRequest } from "next/server";
import { apiV1Error, apiV1Success, ticketmasterErrorCode } from "@/lib/api-v1-response";
import { ticketmasterRateLimitResponse } from "@/lib/api-rate-limit";
import {
  filterLocalEventsForSearch,
  loadPublishedLocalEvents,
  mergeEventSources,
} from "@/lib/local-events";
import {
  parseUpcomingShowsRequest,
  searchUpcomingShows,
} from "@/lib/ticketmaster";

export async function POST(request: NextRequest) {
  const limited = ticketmasterRateLimitResponse(
    request,
    "v1-ticketmaster-events",
    20,
  );
  if (limited) {
    return apiV1Error(
      request,
      429,
      "rate_limited",
      "Too many Ticketmaster searches. Wait a moment and try again.",
      { headers: limited.headers },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiV1Error(request, 400, "bad_request", "Invalid search request.");
  }

  const parsed = parseUpcomingShowsRequest(body);
  if (!parsed.ok) {
    return apiV1Error(request, parsed.status, "bad_request", parsed.message);
  }

  const result = await searchUpcomingShows(parsed);
  if (!result.ok) {
    return apiV1Error(
      request,
      result.status,
      ticketmasterErrorCode(result.status),
      result.message,
    );
  }

  let events = result.shows;
  if (parsed.page === 0) {
    try {
      const localEvents = await loadPublishedLocalEvents();
      const matchedLocalEvents = await filterLocalEventsForSearch(localEvents, {
        attractions: parsed.attractions,
        venues: parsed.venues,
        keyword: parsed.keyword || undefined,
        location:
          parsed.location.postalCode || parsed.location.latitude !== null
            ? {
                postalCode: parsed.location.postalCode || undefined,
                latitude: parsed.location.latitude ?? undefined,
                longitude: parsed.location.longitude ?? undefined,
                radiusMiles: parsed.location.radiusMiles,
              }
            : undefined,
        endDateTime: parsed.endDateTime,
      });
      events = mergeEventSources(events, matchedLocalEvents);
    } catch {
      // Community data should enrich a search, never make Ticketmaster results fail.
    }
  }

  return apiV1Success(request, {
    events,
    page: { ...result.page, resultCount: events.length },
  });
}
