import type { Map as MaplibreMap } from 'maplibre-gl';
import type { LayerConfig, LayerPlugin } from './LayerBase.js';
import { createLayerPlugin } from './layer-registry.js';
import { DayNightOverlay } from './overlays/DayNightOverlay.js';
import { AtmosphereGlow } from './overlays/AtmosphereGlow.js';
import { IdleRotation } from './overlays/IdleRotation.js';
import { ProjectionToggle } from './controls/ProjectionToggle.js';

export interface MapConfig {
  style: string;
  center: [number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
  projection: 'mercator' | 'globe';
  dayNightOverlay: boolean;
  atmosphericGlow: boolean;
  idleRotation: boolean;
  idleRotationSpeed: number;
}

export class MapEngine {
  private container: HTMLElement;
  private mapConfig: MapConfig;
  private map: MaplibreMap | null = null;
  private deckOverlay: unknown = null;
  private layers = new Map<string, { plugin: LayerPlugin; visible: boolean; data: unknown }>();
  private onLayerToggle: ((name: string, visible: boolean) => void) | null = null;

  private dayNightOverlay: DayNightOverlay | null = null;
  private atmosphereGlow: AtmosphereGlow | null = null;
  private idleRotation: IdleRotation | null = null;

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

    // Add projection toggle before navigation controls so it appears above them
    map.addControl(
      new ProjectionToggle(this.mapConfig.projection, (p) => this.onProjectionChange(p)),
      'top-right',
    );
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    this.map = map;

    await new Promise<void>(resolve => {
      map.on('load', () => resolve());
    });

    // Set projection
    map.setProjection({ type: this.mapConfig.projection });

    // Day/Night terminator overlay
    if (this.mapConfig.dayNightOverlay) {
      this.dayNightOverlay = new DayNightOverlay(map);
      this.dayNightOverlay.enable();
    }

    // Atmospheric glow (globe mode only)
    if (this.mapConfig.atmosphericGlow && this.mapConfig.projection === 'globe') {
      this.atmosphereGlow = new AtmosphereGlow(map);
      this.atmosphereGlow.enable();
    }

    // Idle auto-rotation
    if (this.mapConfig.idleRotation) {
      this.idleRotation = new IdleRotation(map, this.mapConfig.idleRotationSpeed, 30_000);
      this.idleRotation.enable();
    }

    // Click-to-zoom
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point);
      const hit = features.find(f => f.layer?.id !== 'day-night-fill');
      if (!hit) return;

      const geom = hit.geometry;
      const center: [number, number] = geom.type === 'Point'
        ? geom.coordinates as [number, number]
        : [e.lngLat.lng, e.lngLat.lat];

      // Pause idle rotation during flyTo
      this.idleRotation?.disable();
      map.flyTo({ center, zoom: 5, pitch: 30, duration: 1500 });
      map.once('moveend', () => {
        if (this.mapConfig.idleRotation && this.idleRotation) {
          this.idleRotation.enable();
        }
      });
    });
  }

  private onProjectionChange(projection: 'mercator' | 'globe'): void {
    if (!this.map) return;

    if (projection === 'globe' && this.mapConfig.atmosphericGlow) {
      if (!this.atmosphereGlow) {
        this.atmosphereGlow = new AtmosphereGlow(this.map);
      }
      this.atmosphereGlow.enable();
    } else {
      this.atmosphereGlow?.disable();
    }
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
    this.dayNightOverlay?.disable();
    this.atmosphereGlow?.disable();
    this.idleRotation?.disable();
    this.map?.remove();
  }
}
