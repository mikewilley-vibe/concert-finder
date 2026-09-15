import { Linking, Platform } from "react-native";

import type { TicketmasterShow } from "./api";
import type { CalendarLink } from "./attendance";
import { hasCalendarEvent, shouldWriteCalendarEvent } from "./attendance";
import type { CalendarEventPayload } from "./calendar-event";
import {
  writeShowCalendarEvent,
  type CalendarEventWriter,
  type CalendarWriteResult,
} from "./calendar-write";
import { websiteUrl } from "./config";

export type AddToCalendarResult = CalendarWriteResult;

export type RemoveFromCalendarResult =
  | { ok: true }
  | { ok: false; code: "denied" | "unavailable"; message: string };

export type NativeCalendarWriter = CalendarEventWriter;

function websiteOrigin() {
  return websiteUrl("/").replace(/\/$/, "");
}

export function openCalendarSettings() {
  void Linking.openSettings();
}

async function loadLegacyCalendar() {
  try {
    return await import("expo-calendar/legacy");
  } catch {
    return null;
  }
}

async function resolveWritableCalendarId(
  Calendar: typeof import("expo-calendar/legacy"),
) {
  if (Platform.OS === "ios" && Calendar.getDefaultCalendarAsync) {
    try {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      if (defaultCalendar?.id) {
        return defaultCalendar.id;
      }
    } catch {
      // Fall through to a writable calendar on this device.
    }
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((calendar) => calendar.allowsModifications);
  const primary = writable.find(
    (calendar) => (calendar as { isPrimary?: boolean }).isPrimary === true,
  );
  return primary?.id ?? writable[0]?.id ?? null;
}

export async function createNativeCalendarWriter(): Promise<
  | { ok: true; writer: NativeCalendarWriter }
  | { ok: false; code: "unavailable"; message: string }
> {
  const Calendar = await loadLegacyCalendar();
  if (!Calendar) {
    return {
      ok: false,
      code: "unavailable",
      message:
        "Calendar access is not available in this Expo Go build. Try again after reloading, or use a ShowSignal device build.",
    };
  }

  const writer: NativeCalendarWriter = {
    async requestPermission() {
      try {
        const permission = await Calendar.requestCalendarPermissionsAsync();
        return permission.status === "granted" ? "granted" : "denied";
      } catch {
        return "unavailable";
      }
    },
    async createEvent(payload: CalendarEventPayload) {
      const calendarId = await resolveWritableCalendarId(Calendar);
      if (!calendarId) {
        throw new Error("No writable calendar");
      }
      const details = {
        title: payload.title,
        startDate: payload.start,
        endDate: payload.end,
        allDay: payload.allDay,
        location: payload.location,
        notes: payload.notes,
        url: payload.url,
      };
      const id = await Calendar.createEventAsync(calendarId, details);
      if (!id) {
        throw new Error("Calendar did not return an event id");
      }
      return { id: String(id) };
    },
    async deleteEvent(eventId: string) {
      await Calendar.deleteEventAsync(eventId);
    },
  };

  return { ok: true, writer };
}

/**
 * Shared write path for native V1 and a future Google Calendar adapter.
 * UI must not create calendar events itself — call this helper.
 */
export async function addShowToCalendar(
  show: TicketmasterShow,
  existingLink?: CalendarLink | null,
  writer?: NativeCalendarWriter,
): Promise<AddToCalendarResult> {
  if (!shouldWriteCalendarEvent(existingLink) && existingLink) {
    return { ok: true, skipped: true, link: existingLink };
  }
  let nativeWriter = writer;
  if (!nativeWriter) {
    const created = await createNativeCalendarWriter();
    if (!created.ok) {
      return created;
    }
    nativeWriter = created.writer;
  }
  return writeShowCalendarEvent(show, existingLink, nativeWriter, websiteOrigin());
}

/**
 * Explicit calendar delete only. Attendance clear / Interested must never call
 * this automatically — later UI can ask “Remove from calendar too?”
 */
export async function removeShowFromCalendar(
  link: CalendarLink | null | undefined,
  writer?: NativeCalendarWriter,
): Promise<RemoveFromCalendarResult> {
  if (!hasCalendarEvent(link) || !link) {
    return { ok: true };
  }
  if (link.provider !== "native") {
    return {
      ok: false,
      code: "unavailable",
      message: "That calendar provider is not connected yet.",
    };
  }

  let nativeWriter = writer;
  if (!nativeWriter) {
    const created = await createNativeCalendarWriter();
    if (!created.ok) {
      return created;
    }
    nativeWriter = created.writer;
  }
  if (!nativeWriter.deleteEvent) {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not remove that concert from Calendar.",
    };
  }

  const permission = await nativeWriter.requestPermission();
  if (permission === "denied") {
    return {
      ok: false,
      code: "denied",
      message:
        "Calendar access is off. Enable it for ShowSignal in Settings, then try again.",
    };
  }
  if (permission !== "granted") {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not ask for calendar access. Try again.",
    };
  }

  try {
    await nativeWriter.deleteEvent(link.externalCalendarEventId);
    return { ok: true };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not remove that concert from Calendar. Try again.",
    };
  }
}
