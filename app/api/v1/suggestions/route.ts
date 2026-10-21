import { apiV1Error, apiV1Success } from "@/lib/api-v1-response";
import { authenticatedUser } from "@/lib/api-auth";
import { ticketmasterRateLimitResponse } from "@/lib/api-rate-limit";
import { AdminConfigError } from "@/lib/supabase/admin-client";
import { loadSuggestionPills, parseSuggestionRequest } from "@/lib/suggestion-feed";
import { loadSuggestionLibrary } from "@/lib/suggestion-library";
import { mergeActivity } from "@/lib/suggestion-pills";

export const dynamic = "force-dynamic";

const EMPTY = {
  artists: [],
  venues: [],
  lastfm: "skipped" as const,
};

export async function POST(request: Request) {
  const limited = ticketmasterRateLimitResponse(
    request,
    "v1-suggestions",
    20,
    60_000,
  );
  if (limited) {
    return apiV1Error(
      request,
      429,
      "rate_limited",
      "Too many suggestion lookups. Wait a moment and try again.",
      { headers: limited.headers },
    );
  }

  let body: unknown = {};
  const raw = await request.text();
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return apiV1Error(request, 400, "bad_request", "Invalid suggestions request.");
    }
  }

  const parsed = parseSuggestionRequest(body);
  if (!parsed.ok) {
    return apiV1Error(request, parsed.status, "bad_request", parsed.message);
  }

  try {
    const user = await authenticatedUser(request);
    if (!user) {
      return apiV1Error(request, 401, "unauthorized", "Unauthorized.");
    }

    const library = await loadSuggestionLibrary(user.id);
    const pills = await loadSuggestionPills({
      follows: library.follows,
      dismissed: library.dismissed,
      activity: {
        artists: mergeActivity([
          ...library.activity.artists,
          ...parsed.openedArtists,
        ]),
        venues: mergeActivity([
          ...library.activity.venues,
          ...parsed.openedVenues,
        ]),
      },
      savedShows: library.savedShows,
      location: parsed.location,
    });
    return apiV1Success(request, pills);
  } catch (error) {
    if (error instanceof AdminConfigError) {
      return apiV1Success(request, EMPTY);
    }
    console.error("Suggestion lookup failed");
    return apiV1Success(request, EMPTY);
  }
}
