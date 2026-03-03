import { PanelBase } from '../PanelBase.js';
import DOMPurify from 'dompurify';

interface TrackedEntity {
  name: string;
  type: string;
  mentions: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  lastSeen?: string;
}

export class EntityTrackerPanel extends PanelBase {
  private entities: TrackedEntity[] = [];

  render(): void {
    this.container.innerHTML = `
      <div class="entity-tracker">
        <div class="entity-tracker-items"></div>
      </div>
    `;
  }

  update(data: unknown): void {
    if (!Array.isArray(data)) return;
    this.entities = data as TrackedEntity[];
    this.renderEntities();
  }

  private renderEntities(): void {
    const itemsEl = this.container.querySelector('.entity-tracker-items');
    if (!itemsEl) return;

    itemsEl.innerHTML = this.entities.map(e => `
      <div class="entity-item">
        <div class="entity-name">${DOMPurify.sanitize(e.name)}</div>
        <div class="entity-meta">
          <span class="entity-type">${DOMPurify.sanitize(e.type)}</span>
          <span class="entity-mentions">${e.mentions} mentions</span>
          ${e.sentiment ? `<span class="entity-sentiment sentiment-${e.sentiment}">${e.sentiment}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
