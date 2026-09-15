import { useCallback, useEffect, useRef, useState } from "react";

import { requestCurrentHomeLocation } from "@/lib/current-location";
import {
  hasGpsFix,
  resolvedSource,
  type HomeLocation,
} from "@/lib/home-location";
import {
  ensureHomeLocationLoaded,
  getHomeLocation,
  isHomeLocationReady,
  saveHomeLocation,
  subscribeHomeLocation,
} from "@/lib/home-location-store";

export function useHomeLocation() {
  const [location, setLocation] = useState<HomeLocation>(getHomeLocation);
  const [ready, setReady] = useState(isHomeLocationReady);
  const [error, setError] = useState<string | null>(null);
  const bootstrapped = useRef(false);

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

  const bootstrapCurrent = useCallback(async () => {
    if (bootstrapped.current) {
      return { ok: true as const, skipped: true };
    }
    const current = getHomeLocation();
    if (resolvedSource(current) === "home" || hasGpsFix(current)) {
      bootstrapped.current = true;
      return { ok: true as const, skipped: true };
    }
    bootstrapped.current = true;
    const result = await requestCurrentHomeLocation();
    if (!result.ok) {
      return result;
    }
    const saved = await save({
      ...getHomeLocation(),
      postalCode: result.location.postalCode,
      latitude: result.location.latitude,
      longitude: result.location.longitude,
      placeLabel: result.location.placeLabel,
      source: "current",
    });
    if (!saved) {
      return {
        ok: false as const,
        code: "unavailable" as const,
        message: "Could not save your current location.",
      };
    }
    return { ok: true as const, skipped: false };
  }, [save]);

  return { location, ready, error, save, bootstrapCurrent };
}
