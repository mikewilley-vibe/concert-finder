type Listener = () => void;

const listeners = new Set<Listener>();

export function subscribeUserLibrary(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyUserLibraryChanged() {
  for (const listener of listeners) {
    listener();
  }
}
