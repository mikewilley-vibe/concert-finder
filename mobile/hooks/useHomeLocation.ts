import { useCallback, useEffect, useState } from "react";

import {
  ensureHomeLocationLoaded,
  getHomeLocation,
  isHomeLocationReady,
  saveHomeLocation,
  subscribeHomeLocation,
} from "@/lib/home-location-store";
import type { HomeLocation } from "@/lib/home-location";

export function useHomeLocation() {
  const [location, setLocation] = useState<HomeLocation>(getHomeLocation);
  const [ready, setReady] = useState(isHomeLocationReady);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setLocation(getHomeLocation());
      setReady(isHomeLocationReady());
    };
    const unsubscribe = subscribeHomeLocation(sync);
    sync();
    void ensureHomeLocationLoaded().catch(() => {
      setError("Could not load your home location.");
      setReady(true);
    });
    return unsubscribe;
  }, []);

  const save = useCallback(async (next: HomeLocation) => {
    const result = await saveHomeLocation(next);
    if (!result.ok) {
      setError("Use a ZIP or postal code like 20003.");
      return false;
    }
    setError(null);
    return true;
  }, []);

  return { location, ready, error, save };
}
