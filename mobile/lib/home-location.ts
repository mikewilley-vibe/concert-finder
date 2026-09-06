export const HOME_LOCATION_STORAGE_KEY = "local-shows:home-location";

export const DEFAULT_RADIUS_MILES = 50;
export const RADIUS_OPTIONS = [25, 50, 100, 250] as const;

export type HomeLocation = {
  postalCode: string;
  radiusMiles: number;
  latitude: number | null;
  longitude: number | null;
};

export const EMPTY_HOME_LOCATION: HomeLocation = {
  postalCode: "",
  radiusMiles: DEFAULT_RADIUS_MILES,
  latitude: null,
  longitude: null,
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
    return {
      postalCode: postal.ok ? postal.postalCode : "",
      radiusMiles,
      latitude: hasPair ? latitude : null,
      longitude: hasPair ? longitude : null,
    };
  } catch {
    return { ...EMPTY_HOME_LOCATION };
  }
}

export function hasGpsFix(location: HomeLocation) {
  return location.latitude !== null && location.longitude !== null;
}

export function upcomingSearchFields(location: HomeLocation) {
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

export function homeLocationLabel(location: HomeLocation) {
  if (location.latitude !== null && location.longitude !== null) {
    if (location.postalCode) {
      return `Within ${location.radiusMiles} miles of your current location (${location.postalCode}).`;
    }
    return `Within ${location.radiusMiles} miles of your current location.`;
  }
  if (!location.postalCode) {
    return "Nationwide for the artists and venues you follow.";
  }
  return `Within ${location.radiusMiles} miles of ${location.postalCode}.`;
}
