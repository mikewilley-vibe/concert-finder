import {
  NEAR_ME_RADIUS_MILES,
  showDistanceMiles,
  type GeoPoint,
  type VenueCoordinates,
} from "./geo.ts";
import {
  filterShowsByDate,
  type ShowDateFilter,
} from "./show-date-filter.ts";
import type { DatedShow } from "./show-windows.ts";

export type ShowListMemory = {
  dateFilter: ShowDateFilter;
  nearMe: boolean;
};

const memory = new Map<string, ShowListMemory>();

export function readShowListFilters(tab: string): ShowListMemory {
  return memory.get(tab) ?? { dateFilter: "all", nearMe: false };
}

export function rememberShowListFilters(tab: string, next: ShowListMemory) {
  memory.set(tab, next);
}

export type DatedVenueShow = DatedShow & VenueCoordinates;

export function applyShowListFilters<T extends DatedVenueShow>(
  shows: readonly T[],
  options: {
    dateFilter: ShowDateFilter;
    nearMe: boolean;
    origin: GeoPoint | null;
    radiusMiles?: number;
    now?: Date;
  },
) {
  const now = options.now ?? new Date();
  const dated = filterShowsByDate(shows, options.dateFilter, now);
  const radiusMiles = options.radiusMiles ?? NEAR_ME_RADIUS_MILES;
  if (!options.nearMe || !options.origin) {
    return {
      shows: dated,
      hiddenForDistance: 0,
      hiddenWithoutCoordinates: 0,
      nearMeApplied: false,
      radiusMiles,
    };
  }

  const next: T[] = [];
  let hiddenForDistance = 0;
  let hiddenWithoutCoordinates = 0;
  for (const show of dated) {
    const miles = showDistanceMiles(show, options.origin);
    if (miles == null) {
      hiddenWithoutCoordinates += 1;
      continue;
    }
    if (miles > radiusMiles) {
      hiddenForDistance += 1;
      continue;
    }
    next.push(show);
  }

  return {
    shows: next,
    hiddenForDistance,
    hiddenWithoutCoordinates,
    nearMeApplied: true,
    radiusMiles,
  };
}

export function countShowsMissingCoordinates(
  shows: readonly VenueCoordinates[],
  origin: GeoPoint | null,
) {
  if (!origin) {
    return 0;
  }
  return shows.filter((show) => showDistanceMiles(show, origin) == null).length;
}

export function showListFilterResetLabel(input: {
  dateFilter: ShowDateFilter;
  nearMe: boolean;
}) {
  if (input.dateFilter !== "all" && input.nearMe) {
    return "Clear filters";
  }
  if (input.nearMe) {
    return "Show all distances";
  }
  return "Show all dates";
}

export function showListFilterEmptyCopy(input: {
  dateFilter: ShowDateFilter;
  nearMe: boolean;
  radiusMiles: number;
  hiddenWithoutCoordinates: number;
  hiddenForDistance: number;
}) {
  const weekend =
    "No shows in this list fall in the weekend window: the coming Friday through Sunday, or today through Sunday if the weekend has already started.";
  const next30 = "No shows in this list are scheduled in the next 30 days.";

  if (input.nearMe && input.dateFilter === "weekend") {
    return {
      title: "No shows match these filters",
      body: `Nothing in this list is this weekend and within ${input.radiusMiles} miles.`,
    };
  }
  if (input.nearMe && input.dateFilter === "next30") {
    return {
      title: "No shows match these filters",
      body: `Nothing in this list is in the next 30 days and within ${input.radiusMiles} miles.`,
    };
  }
  if (input.nearMe) {
    if (input.hiddenWithoutCoordinates > 0 && input.hiddenForDistance === 0) {
      return {
        title: "No distances to compare",
        body: "Near me is on, but these venues don’t include map coordinates, so those shows stay hidden.",
      };
    }
    return {
      title: `Nothing within ${input.radiusMiles} miles`,
      body: `No shows in this list are within ${input.radiusMiles} miles.`,
    };
  }
  if (input.dateFilter === "weekend") {
    return { title: "Nothing this weekend", body: weekend };
  }
  return { title: "Nothing in the next 30 days", body: next30 };
}
