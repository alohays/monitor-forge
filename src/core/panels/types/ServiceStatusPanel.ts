import { PanelBase } from '../PanelBase.js';

interface ServiceStatus {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  lastUpdate: string;
  itemCount: number;
}

export class ServiceStatusPanel extends PanelBase {
  private services: ServiceStatus[] = [];

  render(): void {
    this.container.innerHTML = `
      <div class="service-status">
        <div class="service-status-items"></div>
      </div>
    `;
  }

  update(data: unknown): void {
    if (!Array.isArray(data)) return;
    this.services = data as ServiceStatus[];
    this.renderStatus();
  }

  private renderStatus(): void {
    const itemsEl = this.container.querySelector('.service-status-items');
    if (!itemsEl) return;

    itemsEl.innerHTML = this.services.map(s => {
      const dot = s.status === 'online' ? 'status-green'
        : s.status === 'degraded' ? 'status-yellow' : 'status-red';
      return `
        <div class="service-item">
          <span class="service-dot ${dot}"></span>
          <span class="service-name">${s.name}</span>
          <span class="service-count">${s.itemCount} items</span>
        </div>
      `;
    }).join('');
  }

  destroy(): void { this.container.innerHTML = ''; }
}
