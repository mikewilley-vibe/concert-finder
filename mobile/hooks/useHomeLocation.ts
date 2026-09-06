import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_RADIUS_MILES,
  HOME_LOCATION_STORAGE_KEY,
  parsePostalCode,
  parseStoredHomeLocation,
  type HomeLocation,
} from "@/lib/home-location";

export function useHomeLocation() {
  const [location, setLocation] = useState<HomeLocation>({
    postalCode: "",
    radiusMiles: DEFAULT_RADIUS_MILES,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const raw = await AsyncStorage.getItem(HOME_LOCATION_STORAGE_KEY);
    setLocation(parseStoredHomeLocation(raw));
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void refresh().catch(() => {
      if (!cancelled) {
        setError("Could not load your home location.");
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function save(next: { postalCode: string; radiusMiles: number }) {
    const postal = parsePostalCode(next.postalCode);
    if (!postal.ok) {
      setError("Use a ZIP or postal code like 20003.");
      return false;
    }

    const stored: HomeLocation = {
      postalCode: postal.postalCode,
      radiusMiles: next.radiusMiles,
    };
    await AsyncStorage.setItem(
      HOME_LOCATION_STORAGE_KEY,
      JSON.stringify(stored),
    );
    setLocation(stored);
    setError(null);
    return true;
  }

  return { location, ready, error, save, refresh };
}
