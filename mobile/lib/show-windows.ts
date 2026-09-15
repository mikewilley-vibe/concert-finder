export const NEARBY_DAYS = 7;
export const ARTIST_DAYS = 30;
export const RADAR_DAYS = 14;

export type DatedShow = {
  startsAt?: string | null;
  localDate?: string | null;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function localStamp(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addLocalDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function showLocalStamp(show: DatedShow, now = new Date()) {
  const localDate = show.localDate?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return localDate;
  }
  const startsAt = show.startsAt?.trim() ?? "";
  if (startsAt) {
    const parsed = new Date(startsAt);
    if (!Number.isNaN(parsed.getTime())) {
      return localStamp(parsed);
    }
  }
  return localStamp(now);
}

export function showSortKey(show: DatedShow) {
  const startsAt = show.startsAt?.trim() ?? "";
  if (startsAt) {
    return startsAt;
  }
  const localDate = show.localDate?.trim() ?? "";
  if (localDate) {
    return localDate;
  }
  return "\uFFFF";
}

export function isWithinDays(
  show: DatedShow,
  days: number,
  now = new Date(),
) {
  const stamp = showLocalStamp(show, now);
  const today = localStamp(now);
  const end = localStamp(addLocalDays(now, days - 1));
  return stamp >= today && stamp <= end;
}

export function endDateTimeAfterDays(days: number, now = new Date()) {
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  end.setUTCMinutes(Math.floor(end.getUTCMinutes() / 5) * 5, 0, 0);
  return end.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function scanDateLabel(show: DatedShow, now = new Date()) {
  const stamp = showLocalStamp(show, now);
  const today = localStamp(now);
  if (stamp === today) {
    return "TONIGHT";
  }
  if (stamp === localStamp(addLocalDays(now, 1))) {
    return "TOMORROW";
  }

  const [year, month, day] = stamp.split("-").map(Number);
  if (!year || !month || !day) {
    return stamp.toUpperCase();
  }
  const date = new Date(year, month - 1, day);
  const weekday = date
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const monthLabel = date
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  return `${weekday} ${monthLabel} ${day}`;
}

export function artistReachMiles(radiusMiles: number) {
  const radius = Number.isFinite(radiusMiles) ? radiusMiles : 100;
  return Math.min(500, Math.max(radius, radius + 50));
}
