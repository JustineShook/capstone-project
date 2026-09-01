// utils/geo.ts
// ---------------------------------------------------------------------------
// GEO UTILITIES
// Shared math for calculating distances between coordinates. Used by the
// owner dashboard (and later other map screens) so that "X km away" values
// come from the user's real GPS position instead of static mock numbers.
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Great-circle distance between two coordinates using the Haversine formula.
 * Returns kilometers.
 *
 * The inputs are intentionally plain `{ lat, lng }` objects so any other
 * model that carries coordinates (MockProvider, request shapes) can be
 * passed directly thanks to TypeScript structural typing.
 */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const EARTH_RADIUS_KM = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const deltaLat = toRad(b.lat - a.lat);
  const deltaLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Rough ETA estimate from straight-line distance.
 *
 * Assumes ~30 km/h average city driving (deliberately conservative for
 * urban traffic). Returns whole minutes with a minimum of 1 so the UI
 * never shows "0 min". This is a Phase 2A placeholder — a real road
 * routing API (e.g. OSRM) can replace it later without changing callers.
 */
export function estimateEtaMinutes(distanceKm: number, averageSpeedKmh = 30): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 1;
  return Math.max(1, Math.round((distanceKm / averageSpeedKmh) * 60));
}