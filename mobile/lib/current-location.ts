import { Linking } from "react-native";

import { parsePostalCode, type HomeLocation } from "./home-location";

export type CurrentLocationResult =
  | { ok: true; location: Pick<HomeLocation, "postalCode" | "latitude" | "longitude"> }
  | { ok: false; code: "denied" | "unavailable"; message: string };

type LocationModule = typeof import("expo-location");

function postalFromPlace(postalCode: string | null | undefined) {
  const parsed = parsePostalCode(postalCode ?? "");
  return parsed.ok ? parsed.postalCode : "";
}

async function loadLocationModule(): Promise<
  { ok: true; Location: LocationModule } | { ok: false; message: string }
> {
  try {
    const Location = await import("expo-location");
    return { ok: true, Location };
  } catch {
    return {
      ok: false,
      message:
        "Current location is not available in this Expo Go build. Enter a ZIP instead, or update Expo Go.",
    };
  }
}

export async function requestCurrentHomeLocation(): Promise<CurrentLocationResult> {
  const loaded = await loadLocationModule();
  if (!loaded.ok) {
    return { ok: false, code: "unavailable", message: loaded.message };
  }
  const { Location } = loaded;

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      return {
        ok: false,
        code: "denied",
        message:
          "Location access is off. Enable it for Local Shows in Settings, then try again.",
      };
    }
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message:
        "Could not ask for location access. Enter a ZIP instead.",
    };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    let postalCode = "";
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      postalCode = postalFromPlace(places[0]?.postalCode);
    } catch {
      postalCode = "";
    }

    return {
      ok: true,
      location: { postalCode, latitude, longitude },
    };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "Could not read your current location. Try again, or enter a ZIP.",
    };
  }
}

export function openLocationSettings() {
  void Linking.openSettings();
}
