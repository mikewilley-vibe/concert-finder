import { NextRequest } from "next/server";
import {
  parseUpcomingShowsRequest,
  searchUpcomingShows,
} from "../../../../lib/ticketmaster";
import { ticketmasterRateLimitResponse } from "../../../../lib/api-rate-limit";

export async function POST(request: NextRequest) {
  const limited = ticketmasterRateLimitResponse(
    request,
    "ticketmaster-events",
    20,
  );
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Follow an artist or venue first." },
      { status: 400 },
    );
  }

  const parsed = parseUpcomingShowsRequest(body);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.message },
      { status: parsed.status },
    );
  }

  const result = await searchUpcomingShows({
    attractions: parsed.attractions,
    venues: parsed.venues,
    postalCode: parsed.postalCode,
  });

  if (!result.ok) {
    return Response.json(
      { error: result.message },
      { status: result.status },
    );
  }

  return Response.json({ shows: result.shows });
}
