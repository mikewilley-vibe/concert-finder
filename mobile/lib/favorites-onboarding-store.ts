import AsyncStorage from "@react-native-async-storage/async-storage";

export const FAVORITES_ONBOARDING_STORAGE_KEY =
  "showsignal:v1:favorites-onboarding";

type Listener = () => void;

const listeners = new Set<Listener>();

let dismissed = false;
let ready = false;
let writeGeneration = 0;
let loadPromise: Promise<void> | null = null;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function isFavoritesOnboardingDismissed() {
  return dismissed;
}

export function isFavoritesOnboardingReady() {
  return ready;
}

export function subscribeFavoritesOnboarding(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ensureFavoritesOnboardingLoaded() {
  if (loadPromise) {
    return loadPromise;
  }
  if (ready) {
    return Promise.resolve();
  }

  const startedAt = writeGeneration;
  loadPromise = AsyncStorage.getItem(FAVORITES_ONBOARDING_STORAGE_KEY)
    .then((raw) => {
      if (writeGeneration !== startedAt) {
        return;
      }
      dismissed = raw === "dismissed";
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

export async function dismissFavoritesOnboarding() {
  writeGeneration += 1;
  dismissed = true;
  ready = true;
  notify();
  try {
    await AsyncStorage.setItem(FAVORITES_ONBOARDING_STORAGE_KEY, "dismissed");
  } catch {
    // Keep the in-memory value so this session still skips the prompt.
  }
}
