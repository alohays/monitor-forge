import type { Map as MaplibreMap } from 'maplibre-gl';

export class AtmosphereGlow {
  private map: MaplibreMap;

  constructor(map: MaplibreMap) {
    this.map = map;
  }

  enable(): void {
    this.map.setSky({
      'sky-color': '#0a0a1a',
      'horizon-color': '#1a1a3e',
      'fog-color': '#0a0a1a',
      'fog-ground-blend': 0.5,
      'horizon-fog-blend': 0.8,
      'sky-horizon-blend': 0.9,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    });
  }

  disable(): void {
    this.map.setSky(undefined as never);
  }
}
