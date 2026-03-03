import type { LayerConfig, LayerPlugin } from '../LayerBase.js';

export class PointsLayerPlugin implements LayerPlugin {
  config: LayerConfig;

  constructor(config: LayerConfig) {
    this.config = config;
  }

  createLayer(data: GeoJSON.FeatureCollection): unknown {
    // Returns deck.gl ScatterplotLayer config
    const color = hexToRgb(this.config.color);
    return {
      type: 'ScatterplotLayer',
      id: this.config.name,
      data: data.features,
      getPosition: (d: GeoJSON.Feature) => {
        const coords = (d.geometry as GeoJSON.Point).coordinates;
        return [coords[0], coords[1]];
      },
      getRadius: 5000,
      getFillColor: color,
      pickable: true,
      visible: this.config.defaultVisible,
    };
  }

  async fetchData(): Promise<GeoJSON.FeatureCollection> {
    if (this.config.data.source === 'static' && this.config.data.path) {
      const response = await fetch(`/${this.config.data.path}`);
      return response.json();
    }
    if (this.config.data.source === 'api' && this.config.data.url) {
      const response = await fetch(this.config.data.url);
      return response.json();
    }
    return { type: 'FeatureCollection', features: [] };
  }

  getTooltip(feature: GeoJSON.Feature): string {
    const props = feature.properties ?? {};
    return props.name ?? props.title ?? this.config.displayName;
  }
}

function hexToRgb(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 200];
}
