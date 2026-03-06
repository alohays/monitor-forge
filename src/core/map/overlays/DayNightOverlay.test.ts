import { describe, it, expect } from 'vitest';
import { toJulianDate, getSolarPosition, generateTerminatorGeoJSON } from './DayNightOverlay.js';

describe('toJulianDate', () => {
  it('returns J2000.0 epoch for 2000-01-01T12:00Z', () => {
    const date = new Date('2000-01-01T12:00:00Z');
    expect(toJulianDate(date)).toBeCloseTo(2451545.0, 4);
  });

  it('returns correct JD for Unix epoch', () => {
    const date = new Date('1970-01-01T00:00:00Z');
    expect(toJulianDate(date)).toBeCloseTo(2440587.5, 4);
  });
});

describe('getSolarPosition', () => {
  it('returns declination near +23.44° at summer solstice', () => {
    const date = new Date('2024-06-21T12:00:00Z');
    const { declination } = getSolarPosition(date);
    const declDeg = declination * 180 / Math.PI;
    expect(declDeg).toBeCloseTo(23.44, 0);
  });

  it('returns declination near -23.44° at winter solstice', () => {
    const date = new Date('2024-12-21T12:00:00Z');
    const { declination } = getSolarPosition(date);
    const declDeg = declination * 180 / Math.PI;
    expect(declDeg).toBeCloseTo(-23.44, 0);
  });

  it('returns declination near 0° at equinox', () => {
    const date = new Date('2024-03-20T12:00:00Z');
    const { declination } = getSolarPosition(date);
    const declDeg = declination * 180 / Math.PI;
    expect(Math.abs(declDeg)).toBeLessThan(1);
  });

  it('returns subSolarLng in [-180, 180] range', () => {
    const { subSolarLng } = getSolarPosition(new Date());
    expect(subSolarLng).toBeGreaterThanOrEqual(-180);
    expect(subSolarLng).toBeLessThanOrEqual(180);
  });
});

describe('generateTerminatorGeoJSON', () => {
  it('returns a valid FeatureCollection with one Polygon feature', () => {
    const geojson = generateTerminatorGeoJSON(new Date('2024-06-21T12:00:00Z'));
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0].geometry.type).toBe('Polygon');
  });

  it('has at least 362 coordinates in the polygon ring', () => {
    const geojson = generateTerminatorGeoJSON(new Date('2024-06-21T12:00:00Z'));
    const geom = geojson.features[0].geometry as GeoJSON.Polygon;
    expect(geom.coordinates[0].length).toBeGreaterThanOrEqual(362);
  });

  it('produces valid coordinates (no NaN or Infinity)', () => {
    const geojson = generateTerminatorGeoJSON(new Date('2024-06-21T12:00:00Z'));
    const geom = geojson.features[0].geometry as GeoJSON.Polygon;
    for (const [lng, lat] of geom.coordinates[0]) {
      expect(Number.isFinite(lng)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });

  it('handles equinox edge case without NaN', () => {
    // Near equinox, tan(declination) approaches 0
    const geojson = generateTerminatorGeoJSON(new Date('2024-03-20T09:06:00Z'));
    const geom = geojson.features[0].geometry as GeoJSON.Polygon;
    for (const [lng, lat] of geom.coordinates[0]) {
      expect(Number.isFinite(lng)).toBe(true);
      expect(Number.isFinite(lat)).toBe(true);
    }
  });

  it('polygon ring is closed (first == last coordinate)', () => {
    const geojson = generateTerminatorGeoJSON(new Date('2024-06-21T12:00:00Z'));
    const geom = geojson.features[0].geometry as GeoJSON.Polygon;
    const coords = geom.coordinates[0];
    expect(coords[0]).toEqual(coords[coords.length - 1]);
  });
});
