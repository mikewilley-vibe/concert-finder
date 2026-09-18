export const HOME_LOCATION_STORAGE_KEY = "local-shows:home-location";

export const DEFAULT_RADIUS_MILES = 100;
export const RADIUS_OPTIONS = [25, 50, 100, 250] as const;

export type LocationSource = "current" | "home";

export type HomeLocation = {
  postalCode: string;
  radiusMiles: number;
  latitude: number | null;
  longitude: number | null;
  source: LocationSource;
  placeLabel: string;
  homePostalCode: string;
  homePlaceLabel: string;
  homeLatitude: number | null;
  homeLongitude: number | null;
};

export const EMPTY_HOME_LOCATION: HomeLocation = {
  postalCode: "",
  radiusMiles: DEFAULT_RADIUS_MILES,
  latitude: null,
  longitude: null,
  source: "current",
  placeLabel: "",
  homePostalCode: "",
  homePlaceLabel: "",
  homeLatitude: null,
  homeLongitude: null,
};

export function parsePostalCode(value: string) {
  const postalCode = value.trim().toUpperCase();
  if (!postalCode) {
    return { ok: true as const, postalCode: "" };
  }
  if (!/^[A-Z0-9][A-Z0-9\s-]{1,11}$/.test(postalCode)) {
    return { ok: false as const };
  }
  return { ok: true as const, postalCode };
}

export function parseRadiusMiles(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    return DEFAULT_RADIUS_MILES;
  }
  return value;
}

function parseCoordinate(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
}

function parseSource(value: unknown, fallback: LocationSource): LocationSource {
  return value === "home" || value === "current" ? value : fallback;
}

function parseLabel(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseStoredHomeLocation(raw: string | null): HomeLocation {
  if (!raw) {
    return { ...EMPTY_HOME_LOCATION };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...EMPTY_HOME_LOCATION };
    }
    const record = parsed as {
      postalCode?: unknown;
      radiusMiles?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      source?: unknown;
      placeLabel?: unknown;
      homePostalCode?: unknown;
      homePlaceLabel?: unknown;
      homeLatitude?: unknown;
      homeLongitude?: unknown;
    };
    const postal =
      typeof record.postalCode === "string"
        ? parsePostalCode(record.postalCode)
        : { ok: true as const, postalCode: "" };
    const radiusMiles =
      typeof record.radiusMiles === "number"
        ? parseRadiusMiles(record.radiusMiles)
        : DEFAULT_RADIUS_MILES;
    const latitude = parseCoordinate(record.latitude, -90, 90);
    const longitude = parseCoordinate(record.longitude, -180, 180);
    const hasPair = latitude !== null && longitude !== null;
    const postalCode = postal.ok ? postal.postalCode : "";
    const homePostal =
      typeof record.homePostalCode === "string"
        ? parsePostalCode(record.homePostalCode)
        : { ok: true as const, postalCode: "" };
    const homeLatitude = parseCoordinate(record.homeLatitude, -90, 90);
    const homeLongitude = parseCoordinate(record.homeLongitude, -180, 180);
    const hasHomePair = homeLatitude !== null && homeLongitude !== null;
    const inferredSource: LocationSource = hasPair
      ? "current"
      : postalCode
        ? "home"
        : "current";
    const homePostalCode = homePostal.ok
      ? homePostal.postalCode
      : !hasPair
        ? postalCode
        : "";
    return {
      postalCode,
      radiusMiles,
      latitude: hasPair ? latitude : null,
      longitude: hasPair ? longitude : null,
      source: parseSource(record.source, inferredSource),
      placeLabel: parseLabel(record.placeLabel),
      homePostalCode,
      homePlaceLabel: parseLabel(record.homePlaceLabel),
      homeLatitude: hasHomePair ? homeLatitude : null,
      homeLongitude: hasHomePair ? homeLongitude : null,
    };
  } catch {
    return { ...EMPTY_HOME_LOCATION };
  }
}

export function hasGpsFix(location: HomeLocation) {
  return location.latitude !== null && location.longitude !== null;
}

export function hasHomeArea(location: HomeLocation) {
  return Boolean(
    location.homePostalCode ||
      (location.homeLatitude !== null && location.homeLongitude !== null) ||
      location.homePlaceLabel,
  );
}

export function resolvedSource(location: HomeLocation): LocationSource {
  if (location.source === "home") {
    return hasHomeArea(location) || location.postalCode ? "home" : "current";
  }
  return "current";
}

export function activeOrigin(location: HomeLocation) {
  const source = resolvedSource(location);
  if (source === "home") {
    if (location.homeLatitude !== null && location.homeLongitude !== null) {
      return {
        latitude: location.homeLatitude,
        longitude: location.homeLongitude,
      };
    }
    return null;
  }
  if (hasGpsFix(location)) {
    return {
      latitude: location.latitude as number,
      longitude: location.longitude as number,
    };
  }
  return null;
}

export function upcomingSearchFields(location: HomeLocation) {
  const source = resolvedSource(location);
  if (source === "home") {
    if (location.homeLatitude !== null && location.homeLongitude !== null) {
      return {
        latitude: location.homeLatitude,
        longitude: location.homeLongitude,
        radiusMiles: location.radiusMiles,
      };
    }
    const postalCode = location.homePostalCode || location.postalCode;
    return {
      postalCode: postalCode || undefined,
      radiusMiles: location.radiusMiles,
    };
  }
  if (hasGpsFix(location)) {
    return {
      latitude: location.latitude ?? undefined,
      longitude: location.longitude ?? undefined,
      radiusMiles: location.radiusMiles,
    };
  }
  return {
    postalCode: location.postalCode || undefined,
    radiusMiles: location.radiusMiles,
  };
}

export function activePlaceLabel(location: HomeLocation) {
  const source = resolvedSource(location);
  if (source === "home") {
    return (
      location.homePlaceLabel ||
      location.homePostalCode ||
      location.postalCode ||
      ""
    );
  }
  return location.placeLabel || location.postalCode || "";
}

export function showingNearLine(location: HomeLocation) {
  const place = activePlaceLabel(location);
  if (place) {
    return `Shows near ${place}`;
  }
  if (resolvedSource(location) === "home") {
    return "Shows near your home area";
  }
  return "Shows near your current location";
}

export function radiusLine(location: HomeLocation) {
  const miles = location.radiusMiles;
  if (resolvedSource(location) === "home") {
    const place =
      location.homePlaceLabel ||
      location.homePostalCode ||
      location.postalCode;
    return place
      ? `Within ${miles} miles of ${place}`
      : `Within ${miles} miles of your home area`;
  }
  if (location.placeLabel) {
    return `Within ${miles} miles of your current location`;
  }
  if (location.latitude !== null && location.longitude !== null) {
    if (location.postalCode) {
      return `Within ${miles} miles of your current location (${location.postalCode}).`;
    }
    return `Within ${miles} miles of your current location.`;
  }
  if (!location.postalCode) {
    return "Nationwide for the artists and venues you follow.";
  }
  return `Within ${miles} miles of ${location.postalCode}.`;
}

export function homeLocationLabel(location: HomeLocation) {
  return radiusLine(location);
}

export function hasActiveSearchLocation(location: HomeLocation) {
  const fields = upcomingSearchFields(location);
  return Boolean(fields.latitude || fields.postalCode);
}
