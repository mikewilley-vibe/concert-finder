export const HOME_LOCATION_STORAGE_KEY = "local-shows:home-location";

export const DEFAULT_RADIUS_MILES = 50;
export const RADIUS_OPTIONS = [25, 50, 100, 250] as const;

export type HomeLocation = {
  postalCode: string;
  radiusMiles: number;
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

export function parseStoredHomeLocation(raw: string | null): HomeLocation {
  if (!raw) {
    return { postalCode: "", radiusMiles: DEFAULT_RADIUS_MILES };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { postalCode: "", radiusMiles: DEFAULT_RADIUS_MILES };
    }
    const record = parsed as { postalCode?: unknown; radiusMiles?: unknown };
    const postal =
      typeof record.postalCode === "string"
        ? parsePostalCode(record.postalCode)
        : { ok: true as const, postalCode: "" };
    const radiusMiles =
      typeof record.radiusMiles === "number"
        ? parseRadiusMiles(record.radiusMiles)
        : DEFAULT_RADIUS_MILES;
    return {
      postalCode: postal.ok ? postal.postalCode : "",
      radiusMiles,
    };
  } catch {
    return { postalCode: "", radiusMiles: DEFAULT_RADIUS_MILES };
  }
}

export function homeLocationLabel(location: HomeLocation) {
  if (!location.postalCode) {
    return "Nationwide for the artists and venues you follow.";
  }
  return `Within ${location.radiusMiles} miles of ${location.postalCode}.`;
}
