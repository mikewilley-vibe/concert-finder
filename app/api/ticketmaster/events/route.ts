import { NextRequest } from "next/server";
import {
  parseUpcomingShowsRequest,
  searchUpcomingShows,
} from "../../../../lib/ticketmaster";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
