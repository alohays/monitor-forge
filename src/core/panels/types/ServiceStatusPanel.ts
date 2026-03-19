import DOMPurify from 'dompurify';
import { PanelBase } from '../PanelBase.js';
import type { SourceHealth } from '../../sources/SourceHealth.js';

interface ServiceStatus {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  lastUpdate: string;
  failures: number;
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
    if (data instanceof Map) {
      this.services = Array.from(
        (data as Map<string, SourceHealth>).entries(),
      ).map(([name, health]) => ({
        name,
        status: health.status,
        lastUpdate: health.lastSuccess
          ? health.lastSuccess.toLocaleTimeString()
          : 'never',
        failures: health.consecutiveFailures,
      }));
      this.renderStatus();
      return;
    }
    if (!Array.isArray(data)) return;
    this.services = data as ServiceStatus[];
    this.renderStatus();
  }

  private renderStatus(): void {
    this.markDataReceived();
    const itemsEl = this.container.querySelector('.service-status-items');
    if (!itemsEl) return;

    itemsEl.innerHTML = this.services.map(s => {
      const dot = s.status === 'online' ? 'status-green'
        : s.status === 'degraded' ? 'status-yellow' : 'status-red';
      const meta = s.status === 'online'
        ? s.lastUpdate
        : `${s.failures} failure${s.failures !== 1 ? 's' : ''}`;
      return `
        <div class="service-item">
          <span class="service-dot ${dot}"></span>
          <span class="service-name">${DOMPurify.sanitize(s.name)}</span>
          <span class="service-meta">${DOMPurify.sanitize(meta)}</span>
        </div>
      `;
    }).join('');
  }

  destroy(): void {
    this.cleanupTimers();
    this.container.innerHTML = '';
  }
}
