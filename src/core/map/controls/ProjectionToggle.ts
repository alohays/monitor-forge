import type { Map as MaplibreMap, IControl } from 'maplibre-gl';

export type ProjectionChangeCallback = (projection: 'mercator' | 'globe') => void;

export class ProjectionToggle implements IControl {
  private container: HTMLElement | null = null;
  private map: MaplibreMap | null = null;
  private currentProjection: 'mercator' | 'globe';
  private onProjectionChange: ProjectionChangeCallback | null;

  constructor(
    initialProjection: 'mercator' | 'globe',
    onProjectionChange?: ProjectionChangeCallback,
  ) {
    this.currentProjection = initialProjection;
    this.onProjectionChange = onProjectionChange ?? null;
  }

  onAdd(map: MaplibreMap): HTMLElement {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'forge-projection-btn';
    btn.textContent = this.currentProjection === 'globe' ? '2D' : '3D';
    btn.title = this.currentProjection === 'globe' ? 'Switch to flat map' : 'Switch to globe';

    btn.addEventListener('click', () => this.toggle(btn));
    this.container.appendChild(btn);
    return this.container;
  }

  private toggle(btn: HTMLButtonElement): void {
    const newProjection = this.currentProjection === 'globe' ? 'mercator' : 'globe';
    this.currentProjection = newProjection;

    this.map?.setProjection({ type: newProjection });

    if (newProjection === 'globe') {
      this.map?.flyTo({ zoom: Math.min(this.map.getZoom(), 5), duration: 600 });
    } else {
      this.map?.flyTo({ pitch: 0, duration: 600 });
    }

    btn.textContent = newProjection === 'globe' ? '2D' : '3D';
    btn.title = newProjection === 'globe' ? 'Switch to flat map' : 'Switch to globe';

    this.onProjectionChange?.(newProjection);
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
    this.map = null;
  }
}
