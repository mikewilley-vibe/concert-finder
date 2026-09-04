import { NextRequest } from "next/server";
import { apiV1Error, apiV1Success, ticketmasterErrorCode } from "@/lib/api-v1-response";
import { ticketmasterRateLimitResponse } from "@/lib/api-rate-limit";
import {
  parseSearchKeyword,
  searchTicketmasterVenues,
} from "@/lib/ticketmaster";

export async function GET(request: NextRequest) {
  const limited = ticketmasterRateLimitResponse(
    request,
    "v1-ticketmaster-venues",
    30,
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

  const parsed = parseSearchKeyword(request.nextUrl.searchParams.get("keyword"));
  if (!parsed.ok) {
    return apiV1Error(request, parsed.status, "bad_request", parsed.message);
  }

  const result = await searchTicketmasterVenues(parsed.keyword);
  if (!result.ok) {
    return apiV1Error(
      request,
      result.status,
      ticketmasterErrorCode(result.status),
      result.message,
    );
  }

  return apiV1Success(request, { venues: result.venues });
}
