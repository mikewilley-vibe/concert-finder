import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  EMPTY_HOME_LOCATION,
  HOME_LOCATION_STORAGE_KEY,
  parsePostalCode,
  parseStoredHomeLocation,
  type HomeLocation,
} from "./home-location";

type Listener = () => void;

const listeners = new Set<Listener>();

let current: HomeLocation = { ...EMPTY_HOME_LOCATION };
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
  if (loadPromise) {
    return loadPromise;
  }
  if (ready) {
    return Promise.resolve();
  }

  const startedAt = writeGeneration;
  let finished = false;

  const unblock = setTimeout(() => {
    if (finished) {
      return;
    }
    ready = true;
    notify();
  }, 2000);

  loadPromise = AsyncStorage.getItem(HOME_LOCATION_STORAGE_KEY)
    .then((raw) => {
      if (writeGeneration !== startedAt) {
        return;
      }
      current = parseStoredHomeLocation(raw);
    })
    .catch(() => {
      // Keep the in-memory value if storage is unavailable.
    })
    .finally(() => {
      finished = true;
      clearTimeout(unblock);
      ready = true;
      loadPromise = null;
      notify();
    });

  return loadPromise;
}

export async function saveHomeLocation(next: HomeLocation) {
  const postal = parsePostalCode(next.postalCode);
  if (!postal.ok) {
    return { ok: false as const };
  }

  const hasPair =
    next.latitude !== null &&
    next.longitude !== null &&
    Number.isFinite(next.latitude) &&
    Number.isFinite(next.longitude);

  writeGeneration += 1;
  current = {
    postalCode: postal.postalCode,
    radiusMiles: next.radiusMiles,
    latitude: hasPair ? next.latitude : null,
    longitude: hasPair ? next.longitude : null,
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
