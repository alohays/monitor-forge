import { PanelBase } from '../PanelBase.js';
import type { SourceItem } from '../../sources/SourceBase.js';
import DOMPurify from 'dompurify';

export class NewsFeedPanel extends PanelBase {
  private items: SourceItem[] = [];
  private maxItems: number;

  constructor(container: HTMLElement, config: import('../PanelBase.js').PanelConfig) {
    super(container, config);
    this.maxItems = (config.config.maxItems as number) ?? 50;
  }

  render(): void {
    this.container.innerHTML = `
      <div class="news-feed">
        <div class="news-feed-items"></div>
      </div>
    `;
  }

  update(data: unknown): void {
    if (!Array.isArray(data)) return;
    this.items = (data as SourceItem[]).slice(0, this.maxItems);
    this.renderItems();
  }

  private renderItems(): void {
    const itemsContainer = this.container.querySelector('.news-feed-items');
    if (!itemsContainer) return;

    itemsContainer.innerHTML = this.items.map(item => `
      <article class="news-item">
        <a href="${DOMPurify.sanitize(item.url)}" target="_blank" rel="noopener">
          <h4 class="news-item-title">${DOMPurify.sanitize(item.title)}</h4>
        </a>
        <div class="news-item-meta">
          <span class="news-item-source">${DOMPurify.sanitize(item.source)}</span>
          <time class="news-item-time">${this.formatTime(item.timestamp)}</time>
          ${item.sentiment ? `<span class="news-item-sentiment sentiment-${item.sentiment}">${item.sentiment}</span>` : ''}
        </div>
        ${item.summary ? `<p class="news-item-summary">${DOMPurify.sanitize(item.summary.slice(0, 200))}</p>` : ''}
      </article>
    `).join('');
  }

  private formatTime(date: Date): string {
    const now = Date.now();
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
