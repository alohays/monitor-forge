import type { LayerConfig, LayerPlugin } from '../LayerBase.js';

export class LinesLayerPlugin implements LayerPlugin {
  config: LayerConfig;

  constructor(config: LayerConfig) {
    this.config = config;
  }

  createLayer(data: GeoJSON.FeatureCollection): unknown {
    const color = hexToRgb(this.config.color);
    return {
      type: 'GeoJsonLayer',
      id: this.config.name,
      data,
      stroked: true,
      filled: false,
      getLineColor: color,
      getLineWidth: 2,
      lineWidthMinPixels: 1,
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
    return feature.properties?.name ?? this.config.displayName;
  }
}

function hexToRgb(hex: string): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, 180];
}
