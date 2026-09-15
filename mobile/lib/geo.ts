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
