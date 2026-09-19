import { searchUpcomingShows } from "./api";
import {
  activeOrigin,
  hasActiveSearchLocation,
  upcomingSearchFields,
  type HomeLocation,
} from "./home-location";
import {
  buildOnboardingSuggestions,
  type OnboardingSuggestions,
} from "./onboarding-suggestion-ranking";
import { endDateTimeAfterDays } from "./show-windows";

export type {
  OnboardingSuggestion,
  OnboardingSuggestions,
} from "./onboarding-suggestion-ranking";

export const ONBOARDING_SUGGESTION_DAYS = 30;

export async function loadOnboardingSuggestions(input: {
  location: HomeLocation;
  now?: Date;
  search?: typeof searchUpcomingShows;
}) {
  if (!hasActiveSearchLocation(input.location)) {
    return { venues: [], artists: [] } satisfies OnboardingSuggestions;
  }
  const search = input.search ?? searchUpcomingShows;
  const result = await search({
    attractions: [],
    venues: [],
    ...upcomingSearchFields(input.location),
    endDateTime: endDateTimeAfterDays(
      ONBOARDING_SUGGESTION_DAYS + 1,
      input.now,
    ),
    pageSize: 50,
  });
  return buildOnboardingSuggestions(
    result.shows,
    activeOrigin(input.location),
  );
}
