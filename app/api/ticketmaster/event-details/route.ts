import { NextRequest } from "next/server";
import {
  lookupEventsByIds,
  parseEventDetailIds,
} from "../../../../lib/ticketmaster";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
