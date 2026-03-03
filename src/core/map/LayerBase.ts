export interface LayerConfig {
  name: string;
  type: string;
  displayName: string;
  color: string;
  icon?: string;
  data: {
    source: 'static' | 'api' | 'source-ref';
    path?: string;
    url?: string;
    sourceRef?: string;
  };
  defaultVisible: boolean;
  category: string;
}

export interface LayerPlugin {
  config: LayerConfig;
  createLayer(data: GeoJSON.FeatureCollection): unknown;
  fetchData?(): Promise<GeoJSON.FeatureCollection>;
  getTooltip?(feature: GeoJSON.Feature): string;
}
