import { checkGeofence, haversineDistanceM, GeofenceSchoolConfig } from './geofence';

const school: GeofenceSchoolConfig = { lat: 32.8872, lng: 13.1913, radiusM: 150, maxAccuracyM: 50 };

const baseScan = {
  lat: school.lat,
  lng: school.lng,
  accuracyM: 10,
  isMockLocation: false,
  locationAgeMs: 1000,
};

describe('haversineDistanceM', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceM(32.8872, 13.1913, 32.8872, 13.1913)).toBe(0);
  });

  it('returns a sensible distance for two known points (~1km apart)', () => {
    // 0.009 deg latitude ≈ 1000m
    const d = haversineDistanceM(32.8872, 13.1913, 32.8962, 13.1913);
    expect(d).toBeGreaterThan(950);
    expect(d).toBeLessThan(1050);
  });
});

describe('checkGeofence', () => {
  it('accepts a precise, fresh, real scan inside the radius', () => {
    const result = checkGeofence(baseScan, school);
    expect(result.ok).toBe(true);
    expect(result.distanceM).toBeCloseTo(0, 1);
  });

  it('rejects a mock location regardless of anything else', () => {
    const result = checkGeofence({ ...baseScan, isMockLocation: true }, school);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('MOCK_LOCATION');
  });

  it('rejects when accuracy is worse than max_accuracy_m', () => {
    const result = checkGeofence({ ...baseScan, accuracyM: 51 }, school);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ACCURACY_TOO_LOW');
  });

  it('accepts exactly at the accuracy boundary', () => {
    const result = checkGeofence({ ...baseScan, accuracyM: 50 }, school);
    expect(result.ok).toBe(true);
  });

  it('rejects a location fix older than 30 seconds', () => {
    const result = checkGeofence({ ...baseScan, locationAgeMs: 30001 }, school);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('LOCATION_TOO_OLD');
  });

  it('accepts exactly at the 30 second boundary', () => {
    const result = checkGeofence({ ...baseScan, locationAgeMs: 30000 }, school);
    expect(result.ok).toBe(true);
  });

  it('rejects a scan outside the configured radius', () => {
    const farScan = { ...baseScan, lat: school.lat + 0.01 }; // ~1.1km away
    const result = checkGeofence(farScan, school);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('OUTSIDE_RADIUS');
  });

  it('accepts exactly at the radius boundary', () => {
    // construct a point whose distance is just under radiusM
    const result = checkGeofence({ ...baseScan, lat: school.lat + 0.001 }, school);
    const distance = haversineDistanceM(school.lat + 0.001, school.lng, school.lat, school.lng);
    expect(distance).toBeLessThan(150);
    expect(result.ok).toBe(true);
  });

  it('checks reasons in priority order: mock > accuracy > age > radius', () => {
    const worstCase = {
      lat: school.lat + 1,
      lng: school.lng,
      accuracyM: 999,
      isMockLocation: true,
      locationAgeMs: 999999,
    };
    expect(checkGeofence(worstCase, school).reason).toBe('MOCK_LOCATION');
    expect(checkGeofence({ ...worstCase, isMockLocation: false }, school).reason).toBe('ACCURACY_TOO_LOW');
    expect(checkGeofence({ ...worstCase, isMockLocation: false, accuracyM: 10 }, school).reason).toBe('LOCATION_TOO_OLD');
  });
});
