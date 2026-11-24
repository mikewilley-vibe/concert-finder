export type GeoPoint = {
  latitude: number;
  longitude: number;
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

export function formatDistanceMiles(miles: number) {
  if (miles < 1) {
    return "Under 1 mi";
  }
  return `${Math.round(miles)} mi`;
}

/** Client-side "Near me" cutoff. Separate from the profile search radius. */
export const NEAR_ME_RADIUS_MILES = 50;

export type VenueCoordinates = {
  venueLatitude?: number | null;
  venueLongitude?: number | null;
};

/**
 * Ticketmaster events already include venue latitude/longitude on the v1
 * payload (`venue.latitude` / `venue.longitude`), mapped onto shows as
 * `venueLatitude` / `venueLongitude`. Saved-show snapshots do not store
 * coordinates, and some venues omit them. There is no Supabase geo column.
 */
export function venueCoordinates(show: VenueCoordinates): GeoPoint | null {
  const { venueLatitude: latitude, venueLongitude: longitude } = show;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function showDistanceMiles(
  show: VenueCoordinates,
  origin: GeoPoint | null,
) {
  const venue = venueCoordinates(show);
  if (!origin || !venue) {
    return null;
  }
  return distanceMiles(origin, venue);
}

export function showDistanceLabel(
  show: VenueCoordinates,
  origin: GeoPoint | null,
) {
  const miles = showDistanceMiles(show, origin);
  if (miles == null) {
    return null;
  }
  return formatDistanceMiles(miles);
}

export function isShowWithinRadius(
  show: VenueCoordinates,
  origin: GeoPoint | null,
  radiusMiles: number,
) {
  const miles = showDistanceMiles(show, origin);
  if (miles == null) {
    return false;
  }
  return miles <= radiusMiles;
}
