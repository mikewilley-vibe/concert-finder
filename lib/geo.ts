export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type SearchOrigin = GeoPoint & {
  radiusMiles: number;
};

export type SearchLocation = {
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  radiusMiles: number;
};

const EARTH_RADIUS_MILES = 3958.7613;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function distanceMiles(from: GeoPoint, to: GeoPoint) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRadians(to.longitude - from.longitude);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(hav)));
}

export function isWithinRadius(
  from: GeoPoint,
  to: GeoPoint,
  radiusMiles: number,
) {
  return distanceMiles(from, to) <= radiusMiles;
}

function readCoordinate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function postalGeocodeUrl(postalCode: string) {
  const compact = postalCode.trim().toUpperCase().replace(/[\s-]/g, "");
  if (/^\d{5}(\d{4})?$/.test(compact)) {
    return `https://api.zippopotam.us/us/${compact.slice(0, 5)}`;
  }
  if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)) {
    return `https://api.zippopotam.us/ca/${compact.slice(0, 3)}`;
  }
  return null;
}

export function parseZippopotamPlaces(payload: unknown): GeoPoint | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const places = (payload as { places?: unknown }).places;
  if (!Array.isArray(places) || places.length === 0) {
    return null;
  }
  const place = places[0];
  if (!place || typeof place !== "object") {
    return null;
  }
  const latitude = readCoordinate((place as { latitude?: unknown }).latitude);
  const longitude = readCoordinate((place as { longitude?: unknown }).longitude);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export async function geocodePostalCode(
  postalCode: string,
): Promise<GeoPoint | null> {
  const url = postalGeocodeUrl(postalCode);
  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return null;
    }
    return parseZippopotamPlaces(await response.json());
  } catch {
    return null;
  }
}

export async function resolveSearchOrigin(
  location: SearchLocation,
): Promise<SearchOrigin | null> {
  if (location.latitude !== null && location.longitude !== null) {
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMiles: location.radiusMiles,
    };
  }
  if (!location.postalCode) {
    return null;
  }
  const geocoded = await geocodePostalCode(location.postalCode);
  if (!geocoded) {
    return null;
  }
  return {
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    radiusMiles: location.radiusMiles,
  };
}

/**
 * Ticketmaster Discovery `postalCode` is an exact venue-zip text match, not a
 * radius center. Always send `latlong` + `radius` + `unit` instead.
 */
export function ticketmasterLocationParams(origin: SearchOrigin | null) {
  if (!origin) {
    return {} as Record<string, string>;
  }
  return {
    latlong: `${origin.latitude},${origin.longitude}`,
    radius: String(origin.radiusMiles),
    unit: "miles",
  };
}

export function filterShowsByRadius<
  T extends {
    venue: { latitude: number | null; longitude: number | null };
  },
>(shows: T[], origin: SearchOrigin): T[] {
  return shows.filter((show) => {
    const { latitude, longitude } = show.venue;
    if (latitude === null || longitude === null) {
      return true;
    }
    return isWithinRadius(origin, { latitude, longitude }, origin.radiusMiles);
  });
}
