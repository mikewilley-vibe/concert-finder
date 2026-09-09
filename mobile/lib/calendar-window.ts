export type CalendarShowTimes = {
  localDate?: string;
  localTime?: string;
  startsAt?: string;
};

export type CalendarWindow =
  | { ok: true; start: Date; end: Date; allDay: boolean }
  | { ok: false };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;
const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

function padTime(localTime: string) {
  return localTime.length === 5 ? `${localTime}:00` : localTime;
}

export function calendarWindow(show: CalendarShowTimes): CalendarWindow {
  if (show.startsAt) {
    const start = new Date(show.startsAt);
    if (!Number.isNaN(start.getTime())) {
      return {
        ok: true,
        start,
        end: new Date(start.getTime() + DEFAULT_DURATION_MS),
        allDay: false,
      };
    }
  }

  const localDate = show.localDate?.trim() ?? "";
  if (!DATE_PATTERN.test(localDate)) {
    return { ok: false };
  }

  const localTime = show.localTime?.trim() ?? "";
  if (TIME_PATTERN.test(localTime)) {
    const start = new Date(`${localDate}T${padTime(localTime)}`);
    if (Number.isNaN(start.getTime())) {
      return { ok: false };
    }
    return {
      ok: true,
      start,
      end: new Date(start.getTime() + DEFAULT_DURATION_MS),
      allDay: false,
    };
  }

  const start = new Date(`${localDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) {
    return { ok: false };
  }
  return { ok: true, start, end: start, allDay: true };
}
