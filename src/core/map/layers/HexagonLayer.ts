import type { LayerConfig, LayerPlugin } from '../LayerBase.js';

export class HexagonLayerPlugin implements LayerPlugin {
  config: LayerConfig;
  constructor(config: LayerConfig) { this.config = config; }

  createLayer(data: GeoJSON.FeatureCollection): unknown {
    return {
      type: 'HexagonLayer',
      id: this.config.name,
      data: data.features,
      getPosition: (d: GeoJSON.Feature) => (d.geometry as GeoJSON.Point).coordinates,
      radius: 10000,
      elevationScale: 100,
      extruded: true,
      pickable: true,
      visible: this.config.defaultVisible,
    };
  }

  async fetchData(): Promise<GeoJSON.FeatureCollection> {
    if (this.config.data.path) return (await fetch(`/${this.config.data.path}`)).json();
    if (this.config.data.url) return (await fetch(this.config.data.url)).json();
    return { type: 'FeatureCollection', features: [] };
  }
}
