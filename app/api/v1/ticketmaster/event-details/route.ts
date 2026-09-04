import { NextRequest } from "next/server";
import { apiV1Error, apiV1Success, ticketmasterErrorCode } from "@/lib/api-v1-response";
import { ticketmasterRateLimitResponse } from "@/lib/api-rate-limit";
import {
  lookupEventsByIds,
  parseEventDetailIds,
} from "@/lib/ticketmaster";

export async function GET(request: NextRequest) {
  const limited = ticketmasterRateLimitResponse(
    request,
    "v1-ticketmaster-event-details",
    60,
  );
  if (limited) {
    return apiV1Error(
      request,
      429,
      "rate_limited",
      "Too many Ticketmaster lookups. Wait a moment and try again.",
      { headers: limited.headers },
    );
  }

  const parsed = parseEventDetailIds(request.nextUrl.searchParams.get("ids"));
  if (!parsed.ok) {
    return apiV1Error(request, parsed.status, "bad_request", parsed.message);
  }

  const result = await lookupEventsByIds(parsed.ids);
  if (!result.ok) {
    return apiV1Error(
      request,
      result.status,
      ticketmasterErrorCode(result.status),
      result.message,
    );
  }

  return apiV1Success(request, { events: result.shows });
}
