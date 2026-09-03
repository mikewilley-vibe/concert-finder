import { NextRequest } from "next/server";
import {
  lookupEventsByIds,
  parseEventDetailIds,
} from "../../../../lib/ticketmaster";
import { ticketmasterRateLimitResponse } from "../../../../lib/api-rate-limit";

export async function GET(request: NextRequest) {
  const limited = ticketmasterRateLimitResponse(
    request,
    "ticketmaster-event-details",
    60,
  );
  if (limited) return limited;

  const parsed = parseEventDetailIds(request.nextUrl.searchParams.get("ids"));
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.message },
      { status: parsed.status },
    );
  }

  const result = await lookupEventsByIds(parsed.ids);
  if (!result.ok) {
    return Response.json(
      { error: result.message },
      { status: result.status },
    );
  }

  return Response.json({ shows: result.shows });
}
