import {
  addLocalDays,
  isWithinDays,
  localStamp,
  showLocalStamp,
  type DatedShow,
} from "./show-windows.ts";

export type ShowDateFilter = "all" | "weekend" | "next30";

export const SHOW_DATE_FILTERS: Array<{
  id: ShowDateFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "weekend", label: "This weekend" },
  { id: "next30", label: "Next 30 days" },
];

export const DEFAULT_SHOW_DATE_FILTER: ShowDateFilter = "all";

/**
 * Upcoming Friday–Sunday, or today through Sunday when today is already
 * Friday, Saturday, or Sunday.
 */
export function weekendBounds(now = new Date()) {
  const day = now.getDay();
  const weekendStarted = day === 0 || day === 5 || day === 6;
  const start = weekendStarted ? addLocalDays(now, 0) : addLocalDays(now, 5 - day);
  const daysUntilSunday = start.getDay() === 0 ? 0 : 7 - start.getDay();
  const end = addLocalDays(start, daysUntilSunday);
  return { start: localStamp(start), end: localStamp(end) };
}

export function showMatchesDateFilter(
  show: DatedShow,
  filter: ShowDateFilter,
  now = new Date(),
) {
  if (filter === "all") {
    return true;
  }
  if (filter === "next30") {
    return isWithinDays(show, 30, now);
  }
  const stamp = showLocalStamp(show, now);
  const bounds = weekendBounds(now);
  return stamp >= bounds.start && stamp <= bounds.end;
}

export function filterShowsByDate<T extends DatedShow>(
  shows: readonly T[],
  filter: ShowDateFilter,
  now = new Date(),
) {
  if (filter === "all") {
    return [...shows];
  }
  return shows.filter((show) => showMatchesDateFilter(show, filter, now));
}
