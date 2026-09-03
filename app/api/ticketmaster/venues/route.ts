import { NextRequest } from "next/server";
import {
  parseSearchKeyword,
  searchTicketmasterVenues,
} from "../../../../lib/ticketmaster";
import { ticketmasterRateLimitResponse } from "../../../../lib/api-rate-limit";

export async function GET(request: NextRequest) {
  const limited = ticketmasterRateLimitResponse(
    request,
    "ticketmaster-venues",
    30,
  );
  if (limited) return limited;

  const parsed = parseSearchKeyword(request.nextUrl.searchParams.get("keyword"));

  if (!parsed.ok) {
    return Response.json(
      { error: parsed.message },
      { status: parsed.status },
    );
  }

  const result = await searchTicketmasterVenues(parsed.keyword);
  if (!result.ok) {
    return Response.json(
      { error: result.message },
      { status: result.status },
    );
  }

  return Response.json({ venues: result.venues });
}
