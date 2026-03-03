import type { LayerConfig, LayerPlugin } from '../LayerBase.js';

export class PolygonsLayerPlugin implements LayerPlugin {
  config: LayerConfig;
  constructor(config: LayerConfig) { this.config = config; }

  createLayer(data: GeoJSON.FeatureCollection): unknown {
    const color = hexToRgb(this.config.color);
    return {
      type: 'GeoJsonLayer',
      id: this.config.name,
      data,
      stroked: true,
      filled: true,
      getFillColor: [...color.slice(0, 3), 60],
      getLineColor: color,
      getLineWidth: 1,
      lineWidthMinPixels: 1,
      pickable: true,
      visible: this.config.defaultVisible,
    };
  }

  async fetchData(): Promise<GeoJSON.FeatureCollection> {
    if (this.config.data.path) return (await fetch(`/${this.config.data.path}`)).json();
    if (this.config.data.url) return (await fetch(this.config.data.url)).json();
    return { type: 'FeatureCollection', features: [] };
  }

  getTooltip(feature: GeoJSON.Feature): string {
    return feature.properties?.name ?? this.config.displayName;
  }
}

function hexToRgb(hex: string): [number, number, number, number] {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16), 180];
}
