import * as Location from "expo-location";
import { Linking } from "react-native";

import { parsePostalCode, type HomeLocation } from "./home-location";

export type CurrentLocationResult =
  | { ok: true; location: Pick<HomeLocation, "postalCode" | "latitude" | "longitude"> }
  | { ok: false; code: "denied" | "unavailable"; message: string };

function postalFromPlace(place: Location.LocationGeocodedAddress) {
  const parsed = parsePostalCode(place.postalCode ?? "");
  return parsed.ok ? parsed.postalCode : "";
}

export async function requestCurrentHomeLocation(): Promise<CurrentLocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== Location.PermissionStatus.GRANTED) {
    return {
      ok: false,
      code: "denied",
      message:
        "Location access is off. Enable it for Expo Go in Settings, then try again.",
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
      postalCode = places[0] ? postalFromPlace(places[0]) : "";
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
