import { timingSafeEqual } from "node:crypto";
import { AdminConfigError, runCheckShows } from "../../../../lib/check-shows";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function hasValidCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization");
  if (!secret || !header) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const summary = await runCheckShows();
    return Response.json(summary);
  } catch (error) {
    if (error instanceof AdminConfigError) {
      return Response.json(
        { error: "Server database access is not configured." },
        { status: 500 },
      );
    }

    console.error("Scheduled show check failed", error);
    return Response.json(
      { error: "Unable to run scheduled check." },
      { status: 500 },
    );
  }
}
