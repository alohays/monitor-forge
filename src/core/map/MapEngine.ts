import type { LayerConfig, LayerPlugin } from './LayerBase.js';
import { createLayerPlugin } from './layer-registry.js';

export interface MapConfig {
  style: string;
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  projection: 'mercator' | 'globe';
  dayNightOverlay: boolean;
}

export class MapEngine {
  private container: HTMLElement;
  private mapConfig: MapConfig;
  private map: unknown = null; // maplibregl.Map
  private deckOverlay: unknown = null;
  private layers = new Map<string, { plugin: LayerPlugin; visible: boolean; data: unknown }>();
  private onLayerToggle: ((name: string, visible: boolean) => void) | null = null;

  constructor(container: HTMLElement, config: MapConfig) {
    this.container = container;
    this.mapConfig = config;
  }

  async initialize(): Promise<void> {
    const maplibregl = await import('maplibre-gl');

    const map = new maplibregl.Map({
      container: this.container,
      style: this.mapConfig.style,
      center: this.mapConfig.center,
      zoom: this.mapConfig.zoom,
      minZoom: this.mapConfig.minZoom,
      maxZoom: this.mapConfig.maxZoom,
      attributionControl: false,
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    this.map = map;

    await new Promise<void>(resolve => {
      map.on('load', () => resolve());
    });
  }

  async addLayer(config: LayerConfig): Promise<void> {
    const plugin = createLayerPlugin(config);
    let data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

    if (plugin.fetchData) {
      try {
        data = await plugin.fetchData();
      } catch (err) {
        console.warn(`Failed to load data for layer "${config.name}":`, err);
      }
    }

    this.layers.set(config.name, {
      plugin,
      visible: config.defaultVisible,
      data,
    });
  }

  toggleLayer(name: string, visible?: boolean): void {
    const layer = this.layers.get(name);
    if (!layer) return;

    layer.visible = visible ?? !layer.visible;
    this.onLayerToggle?.(name, layer.visible);
  }

  getLayerConfigs(): Array<{ name: string; displayName: string; visible: boolean; category: string }> {
    return Array.from(this.layers.entries()).map(([name, layer]) => ({
      name,
      displayName: layer.plugin.config.displayName,
      visible: layer.visible,
      category: layer.plugin.config.category,
    }));
  }

  setLayerToggleHandler(handler: (name: string, visible: boolean) => void): void {
    this.onLayerToggle = handler;
  }

  destroy(): void {
    if (this.map && typeof (this.map as { remove: () => void }).remove === 'function') {
      (this.map as { remove: () => void }).remove();
    }
  }
}
