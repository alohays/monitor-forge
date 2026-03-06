import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';

const SOURCE_ID = 'day-night-terminator';
const LAYER_ID = 'day-night-fill';

// ─── Solar position math (adapted from koala73/worldmonitor) ────

export function toJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

export function getSolarPosition(date: Date): { declination: number; subSolarLng: number } {
  const jd = toJulianDate(date);
  const D = jd - 2451545.0; // days since J2000.0

  const g = ((357.529 + 0.98560028 * D) % 360) * Math.PI / 180; // mean anomaly (rad)
  const q = (280.459 + 0.98564736 * D) % 360; // mean longitude (deg)
  const L = q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g); // ecliptic longitude (deg)

  const eRad = (23.439 - 0.00000036 * D) * Math.PI / 180; // obliquity (rad)
  const LRad = L * Math.PI / 180;

  const declination = Math.asin(Math.sin(eRad) * Math.sin(LRad));
  const RA = Math.atan2(Math.cos(eRad) * Math.sin(LRad), Math.cos(LRad));

  const GMST = ((18.697374558 + 24.06570982441908 * D) % 24) * 15; // sidereal time (deg)
  let subSolarLng = RA * 180 / Math.PI - GMST;
  subSolarLng = ((subSolarLng % 360) + 540) % 360 - 180; // normalize to [-180, 180]

  return { declination, subSolarLng };
}

// ─── Terminator polygon generation ──────────────────────────────

export function generateTerminatorGeoJSON(date: Date): GeoJSON.FeatureCollection {
  const { declination, subSolarLng } = getSolarPosition(date);
  const tanDecl = Math.tan(declination);

  const points: [number, number][] = [];

  if (Math.abs(tanDecl) < 1e-6) {
    // Equinox edge case: terminator is nearly vertical
    for (let lat = -90; lat <= 90; lat++) {
      points.push([subSolarLng + 90, lat]);
    }
    for (let lat = 90; lat >= -90; lat--) {
      points.push([subSolarLng - 90, lat]);
    }
    points.push(points[0]); // close ring
  } else {
    for (let lng = -180; lng <= 180; lng++) {
      const ha = (lng - subSolarLng) * Math.PI / 180;
      const lat = Math.atan(-Math.cos(ha) / tanDecl) * 180 / Math.PI;
      points.push([lng, lat]);
    }
    const darkPole: number = declination > 0 ? -90 : 90;
    points.push([180, darkPole]);
    points.push([-180, darkPole]);
    points.push(points[0]); // close ring
  }

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [points],
      },
    }],
  };
}

// ─── Overlay class ──────────────────────────────────────────────

export class DayNightOverlay {
  private map: MaplibreMap;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(map: MaplibreMap) {
    this.map = map;
  }

  enable(): void {
    const geojson = generateTerminatorGeoJSON(new Date());

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: geojson,
    });

    this.map.addLayer({
      id: LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': '#000014',
        'fill-opacity': 0.35,
      },
    });

    this.intervalId = setInterval(() => this.update(), 60_000);
  }

  private update(): void {
    const source = this.map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (source) {
      source.setData(generateTerminatorGeoJSON(new Date()));
    }
  }

  disable(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.map.getLayer(LAYER_ID)) this.map.removeLayer(LAYER_ID);
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
  }
}
