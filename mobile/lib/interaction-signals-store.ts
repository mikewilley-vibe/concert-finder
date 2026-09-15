import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  INTERACTION_SIGNALS_STORAGE_KEY,
  applyInteraction,
  parseInteractionSignals,
  type InteractionKind,
  type InteractionSignals,
} from "./interaction-signals";

type Listener = () => void;

const listeners = new Set<Listener>();

let current: InteractionSignals = parseInteractionSignals(null);
let ready = false;
let writeGeneration = 0;
let loadPromise: Promise<void> | null = null;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function getInteractionSignals() {
  return current;
}

export function isInteractionSignalsReady() {
  return ready;
}

export function subscribeInteractionSignals(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ensureInteractionSignalsLoaded() {
  if (loadPromise) {
    return loadPromise;
  }
  if (ready) {
    return Promise.resolve();
  }

  const startedAt = writeGeneration;
  loadPromise = AsyncStorage.getItem(INTERACTION_SIGNALS_STORAGE_KEY)
    .then((raw) => {
      if (writeGeneration !== startedAt) {
        return;
      }
      current = parseInteractionSignals(raw);
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

export async function recordInteraction(input: {
  kind: InteractionKind;
  eventId: string;
  artistIds?: readonly string[];
  venueId?: string | null;
  genreIds?: readonly string[];
}) {
  writeGeneration += 1;
  current = applyInteraction(current, input);
  ready = true;
  notify();
  try {
    await AsyncStorage.setItem(
      INTERACTION_SIGNALS_STORAGE_KEY,
      JSON.stringify(current),
    );
  } catch {
    // Keep the in-memory value so ranking still learns this session.
  }
}
