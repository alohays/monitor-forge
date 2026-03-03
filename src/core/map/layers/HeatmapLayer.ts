import type { LayerConfig, LayerPlugin } from '../LayerBase.js';

export class HeatmapLayerPlugin implements LayerPlugin {
  config: LayerConfig;
  constructor(config: LayerConfig) { this.config = config; }

  createLayer(data: GeoJSON.FeatureCollection): unknown {
    return {
      type: 'HeatmapLayer',
      id: this.config.name,
      data: data.features,
      getPosition: (d: GeoJSON.Feature) => (d.geometry as GeoJSON.Point).coordinates,
      getWeight: (d: GeoJSON.Feature) => d.properties?.weight ?? 1,
      radiusPixels: 60,
      intensity: 1,
      threshold: 0.03,
      pickable: false,
      visible: this.config.defaultVisible,
    };
  }

  async fetchData(): Promise<GeoJSON.FeatureCollection> {
    if (this.config.data.path) return (await fetch(`/${this.config.data.path}`)).json();
    if (this.config.data.url) return (await fetch(this.config.data.url)).json();
    return { type: 'FeatureCollection', features: [] };
  }
}
