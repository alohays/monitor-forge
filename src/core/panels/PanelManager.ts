import type { PanelBase, PanelConfig } from './PanelBase.js';
import { createPanel } from './panel-registry.js';

export interface ViewConfig {
  name: string;
  displayName: string;
  panels: string[];
  icon?: string;
  default?: boolean;
}

export class PanelManager {
  private container: HTMLElement;
  private panels = new Map<string, PanelBase[]>();
  private viewContainers = new Map<string, HTMLElement>();
  private activeView: string | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private hashHandler: (() => void) | null = null;
  private viewChangeCallback: ((viewName: string) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  initialize(configs: PanelConfig[], views?: ViewConfig[]): void {
    if (views && views.length > 0) {
      this.initializeWithViews(configs, views);
    } else {
      this.initializeFlat(configs);
    }
  }

  private initializeFlat(configs: PanelConfig[]): void {
    const sorted = [...configs].sort((a, b) => a.position - b.position);
    for (const config of sorted) {
      this.createPanelDOM(this.container, config);
    }
  }

  private initializeWithViews(configs: PanelConfig[], views: ViewConfig[]): void {
    const configMap = new Map(configs.map(c => [c.name, c]));
    const defaultView = views.find(v => v.default) ?? views[0];
    const hashView = this.getViewFromHash();

    for (const view of views) {
      const viewEl = document.createElement('div');
      viewEl.className = 'forge-view';
      viewEl.dataset.view = view.name;

      const isActive = hashView
        ? view.name === hashView
        : view.name === defaultView.name;
      viewEl.style.display = isActive ? 'flex' : 'none';

      const viewPanelConfigs = view.panels
        .map(name => configMap.get(name))
        .filter((c): c is PanelConfig => c !== undefined)
        .sort((a, b) => a.position - b.position);

      for (const config of viewPanelConfigs) {
        this.createPanelDOM(viewEl, config);
      }

      this.container.appendChild(viewEl);
      this.viewContainers.set(view.name, viewEl);
    }

    this.activeView = hashView && this.viewContainers.has(hashView)
      ? hashView
      : defaultView.name;

    // Keyboard shortcuts: 1/2/3 to switch views
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= views.length) {
        this.switchView(views[num - 1].name);
      }
    };
    document.addEventListener('keydown', this.keyHandler);

    // Hash change listener
    this.hashHandler = () => {
      const newView = this.getViewFromHash();
      if (newView && this.viewContainers.has(newView)) {
        this.switchView(newView);
      }
    };
    window.addEventListener('hashchange', this.hashHandler);
  }

  private createPanelDOM(parent: HTMLElement, config: PanelConfig): void {
    try {
      const panelContainer = document.createElement('div');
      panelContainer.className = 'forge-panel';
      panelContainer.dataset.panelName = config.name;

      const header = document.createElement('div');
      header.className = 'forge-panel-header';
      header.innerHTML = `
        <span class="forge-panel-title">${config.displayName}</span>
        <button class="forge-panel-toggle" aria-label="Toggle panel">-</button>
      `;
      panelContainer.appendChild(header);

      const body = document.createElement('div');
      body.className = 'forge-panel-body';
      panelContainer.appendChild(body);

      const toggleBtn = header.querySelector('.forge-panel-toggle')!;
      toggleBtn.addEventListener('click', () => {
        body.classList.toggle('collapsed');
        toggleBtn.textContent = body.classList.contains('collapsed') ? '+' : '-';
      });

      parent.appendChild(panelContainer);

      const panel = createPanel(body, config);
      panel.setPanelElement(panelContainer);
      panel.render();

      const existing = this.panels.get(config.name) ?? [];
      existing.push(panel);
      this.panels.set(config.name, existing);
    } catch (err) {
      console.warn(`Failed to create panel "${config.name}":`, err);
    }
  }

  switchView(viewName: string): void {
    if (this.activeView === viewName) return;
    this.viewContainers.forEach((el, name) => {
      el.style.display = name === viewName ? 'flex' : 'none';
    });
    this.activeView = viewName;
    history.replaceState(null, '', `#view=${viewName}`);
    this.viewChangeCallback?.(viewName);
  }

  onViewChange(callback: (viewName: string) => void): void {
    this.viewChangeCallback = callback;
  }

  getActiveView(): string | null {
    return this.activeView;
  }

  getViewNames(): string[] {
    return Array.from(this.viewContainers.keys());
  }

  private getViewFromHash(): string | null {
    const hash = window.location.hash;
    const match = hash.match(/[#&]view=([a-z0-9-]+)/);
    return match ? match[1] : null;
  }

  updatePanel(name: string, data: unknown): void {
    const instances = this.panels.get(name);
    if (instances) {
      for (const panel of instances) {
        panel.update(data);
      }
    }
  }

  updateAll(data: unknown): void {
    for (const instances of this.panels.values()) {
      for (const panel of instances) {
        panel.update(data);
      }
    }
  }

  destroy(): void {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
    }
    if (this.hashHandler) {
      window.removeEventListener('hashchange', this.hashHandler);
    }
    for (const instances of this.panels.values()) {
      for (const panel of instances) {
        panel.destroy();
      }
    }
    this.panels.clear();
    this.viewContainers.clear();
    this.container.innerHTML = '';
  }
}
