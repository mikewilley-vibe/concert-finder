import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_RADIUS_MILES,
  HOME_LOCATION_STORAGE_KEY,
  parsePostalCode,
  parseStoredHomeLocation,
  type HomeLocation,
} from "./home-location";

type Listener = () => void;

const listeners = new Set<Listener>();

let current: HomeLocation = {
  postalCode: "",
  radiusMiles: DEFAULT_RADIUS_MILES,
};
let ready = false;
let writeGeneration = 0;
let loadPromise: Promise<void> | null = null;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function getHomeLocation() {
  return current;
}

export function isHomeLocationReady() {
  return ready;
}

export function subscribeHomeLocation(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ensureHomeLocationLoaded() {
  if (ready) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }

  const startedAt = writeGeneration;
  loadPromise = Promise.race([
    AsyncStorage.getItem(HOME_LOCATION_STORAGE_KEY).then((raw) => {
      if (writeGeneration !== startedAt) {
        return;
      }
      current = parseStoredHomeLocation(raw);
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 2000);
    }),
  ])
    .catch(() => {
      // Keep the in-memory default if storage is unavailable.
    })
    .finally(() => {
      ready = true;
      loadPromise = null;
      notify();
    });

  return loadPromise;
}

export async function saveHomeLocation(next: {
  postalCode: string;
  radiusMiles: number;
}) {
  const postal = parsePostalCode(next.postalCode);
  if (!postal.ok) {
    return { ok: false as const };
  }

  writeGeneration += 1;
  current = {
    postalCode: postal.postalCode,
    radiusMiles: next.radiusMiles,
  };
  ready = true;
  notify();

  try {
    await AsyncStorage.setItem(
      HOME_LOCATION_STORAGE_KEY,
      JSON.stringify(current),
    );
  } catch {
    // Keep the in-memory value so this session still uses the new area.
  }

  return { ok: true as const, location: current };
}
