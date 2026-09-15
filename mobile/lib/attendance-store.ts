import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ATTENDANCE_STORAGE_KEY,
  applyAttendanceStatus,
  mergeAttendanceStates,
  parseAttendanceState,
  rememberCalendarLink,
  type AttendanceState,
  type AttendanceStatus,
  type CalendarLink,
} from "./attendance";
import type { TicketmasterShow } from "./api";

type Listener = () => void;

const listeners = new Set<Listener>();

let current: AttendanceState = parseAttendanceState(null);
let ready = false;
let writeGeneration = 0;
let loadPromise: Promise<void> | null = null;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function getAttendanceState() {
  return current;
}

export function isAttendanceReady() {
  return ready;
}

export function subscribeAttendance(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function persist(next: AttendanceState) {
  try {
    await AsyncStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep the in-memory value so this session still has the latest status.
  }
}

export function ensureAttendanceLoaded() {
  if (loadPromise) {
    return loadPromise;
  }
  if (ready) {
    return Promise.resolve();
  }

  const startedAt = writeGeneration;
  loadPromise = AsyncStorage.getItem(ATTENDANCE_STORAGE_KEY)
    .then((raw) => {
      if (writeGeneration !== startedAt) {
        return;
      }
      current = parseAttendanceState(raw);
    })
    .catch(() => {
      // Keep the in-memory value if storage is unavailable.
    })
    .finally(() => {
      ready = true;
      loadPromise = null;
      notify();
    });

  return loadPromise;
}

export async function writeAttendanceStatus(
  show: TicketmasterShow,
  status: AttendanceStatus | null,
) {
  writeGeneration += 1;
  current = applyAttendanceStatus(current, show, status);
  ready = true;
  notify();
  await persist(current);
  return current;
}

export async function writeCalendarLink(
  show: TicketmasterShow,
  link: CalendarLink,
) {
  writeGeneration += 1;
  current = rememberCalendarLink(current, show.id, link, show);
  ready = true;
  notify();
  await persist(current);
  return current;
}

export async function replaceAttendanceState(next: AttendanceState) {
  writeGeneration += 1;
  current = next;
  ready = true;
  notify();
  await persist(current);
  return current;
}

export async function mergeRemoteAttendance(remote: AttendanceState) {
  writeGeneration += 1;
  current = mergeAttendanceStates(current, remote);
  ready = true;
  notify();
  await persist(current);
  return current;
}
