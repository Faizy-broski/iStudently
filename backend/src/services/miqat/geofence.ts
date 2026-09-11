// Layer 2 (mandatory) — geofence check. GPS is unreliable indoors and in
// dense urban areas, so this is a coarse filter, not the primary proof of
// presence (Layer 3 is). Pure function: no DB, no clock reads except what's
// passed in, so it's fully unit-testable against fixed fixtures.

export interface GeofenceScan {
  lat: number;
  lng: number;
  accuracyM: number;
  isMockLocation: boolean;
  locationAgeMs: number;
}

export interface GeofenceSchoolConfig {
  lat: number;
  lng: number;
  radiusM: number;
  maxAccuracyM: number;
}

export type GeofenceRejectReason = 'MOCK_LOCATION' | 'ACCURACY_TOO_LOW' | 'LOCATION_TOO_OLD' | 'OUTSIDE_RADIUS';

export interface GeofenceResult {
  ok: boolean;
  reason?: GeofenceRejectReason;
  distanceM: number;
}

const MAX_LOCATION_AGE_MS = 30_000;
const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance between two lat/lng points, in metres. */
export function haversineDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Checks are ordered cheapest/most-certain-to-reject first: a mock location
 * or a stale/imprecise fix is rejected before we bother computing distance.
 */
export function checkGeofence(scan: GeofenceScan, school: GeofenceSchoolConfig): GeofenceResult {
  const distanceM = haversineDistanceM(scan.lat, scan.lng, school.lat, school.lng);

  if (scan.isMockLocation) {
    return { ok: false, reason: 'MOCK_LOCATION', distanceM };
  }
  if (scan.accuracyM > school.maxAccuracyM) {
    return { ok: false, reason: 'ACCURACY_TOO_LOW', distanceM };
  }
  if (scan.locationAgeMs > MAX_LOCATION_AGE_MS) {
    return { ok: false, reason: 'LOCATION_TOO_OLD', distanceM };
  }
  if (distanceM > school.radiusM) {
    return { ok: false, reason: 'OUTSIDE_RADIUS', distanceM };
  }
  return { ok: true, distanceM };
}
