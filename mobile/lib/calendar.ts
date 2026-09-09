import { Linking } from "react-native";

import type { TicketmasterShow } from "./api";
import { calendarWindow } from "./calendar-window";
import { showPlace } from "./show-format";

export type AddToCalendarResult =
  | { ok: true }
  | { ok: false; code: "no_date" | "denied" | "unavailable"; message: string };

export function openCalendarSettings() {
  void Linking.openSettings();
}

export async function addShowToCalendar(
  show: TicketmasterShow,
): Promise<AddToCalendarResult> {
  const window = calendarWindow(show);
  if (!window.ok) {
    return {
      ok: false,
      code: "no_date",
      message: "This concert does not have a date to add yet.",
    };
  }

  let Calendar: typeof import("expo-calendar/legacy");
  try {
    Calendar = await import("expo-calendar/legacy");
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message:
        "Calendar access is not available in this Expo Go build. Try again after reloading, or use a Local Shows device build.",
    };
  }

  try {
    const permission = await Calendar.requestCalendarPermissionsAsync();
    if (permission.status !== "granted") {
      return {
        ok: false,
        code: "denied",
        message:
          "Calendar access is off. Enable it for Expo Go in Settings, then try again.",
      };
    }
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not ask for calendar access. Try again.",
    };
  }

  try {
    const place = [show.venueName, showPlace(show)].filter(Boolean).join(", ");
    const details = {
      title: show.name,
      startDate: window.start,
      endDate: window.end,
      allDay: window.allDay,
      location: place || undefined,
      notes: show.url,
      url: show.url,
    };
    await Calendar.createEventInCalendarAsync(details);
    return { ok: true };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not add that concert to Calendar. Try again.",
    };
  }
}
