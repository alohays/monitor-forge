import type { PanelBase, PanelConfig } from './PanelBase.js';
import { createPanel } from './panel-registry.js';

export class PanelManager {
  private container: HTMLElement;
  private panels = new Map<string, PanelBase>();

  constructor(container: HTMLElement) {
    this.container = container;
  }

  initialize(configs: PanelConfig[]): void {
    // Sort by position
    const sorted = [...configs].sort((a, b) => a.position - b.position);

    for (const config of sorted) {
      try {
        const panelContainer = document.createElement('div');
        panelContainer.className = 'forge-panel';
        panelContainer.dataset.panelName = config.name;

        // Panel header
        const header = document.createElement('div');
        header.className = 'forge-panel-header';
        header.innerHTML = `
          <span class="forge-panel-title">${config.displayName}</span>
          <button class="forge-panel-toggle" aria-label="Toggle panel">-</button>
        `;
        panelContainer.appendChild(header);

        // Panel body
        const body = document.createElement('div');
        body.className = 'forge-panel-body';
        panelContainer.appendChild(body);

        // Toggle
        const toggleBtn = header.querySelector('.forge-panel-toggle')!;
        toggleBtn.addEventListener('click', () => {
          body.classList.toggle('collapsed');
          toggleBtn.textContent = body.classList.contains('collapsed') ? '+' : '-';
        });

        this.container.appendChild(panelContainer);

        const panel = createPanel(body, config);
        panel.setPanelElement(panelContainer);
        panel.render();
        this.panels.set(config.name, panel);
      } catch (err) {
        console.warn(`Failed to create panel "${config.name}":`, err);
      }
    }
  }

  updatePanel(name: string, data: unknown): void {
    const panel = this.panels.get(name);
    if (panel) panel.update(data);
  }

  updateAll(data: unknown): void {
    for (const panel of this.panels.values()) {
      panel.update(data);
    }
  }

  destroy(): void {
    for (const panel of this.panels.values()) {
      panel.destroy();
    }
    this.panels.clear();
    this.container.innerHTML = '';
  }
}
