import { PanelBase } from '../PanelBase.js';
import type { SourceItem } from '../../sources/SourceBase.js';
import DOMPurify from 'dompurify';

export class NewsFeedPanel extends PanelBase {
  private renderedItems = new Map<string, HTMLElement>();
  private itemsContainer: HTMLElement | null = null;
  private maxItems: number;
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(container: HTMLElement, config: import('../PanelBase.js').PanelConfig) {
    super(container, config);
    this.maxItems = (config.config.maxItems as number) ?? 50;
  }

  render(): void {
    this.container.innerHTML = '<div class="news-feed"><div class="news-feed-items"></div></div>';
    this.showSkeleton(5);
    this.itemsContainer = this.container.querySelector('.news-feed-items');
  }

  update(data: unknown): void {
    if (!Array.isArray(data)) return;
    const items = (data as SourceItem[]).slice(0, this.maxItems);
    this.markDataReceived();
    this.diffUpdate(items);
  }

  private diffUpdate(items: SourceItem[]): void {
    if (!this.itemsContainer) return;

    const newIds = new Set(items.map(i => i.id));
    let newItemIndex = 0;

    // Remove items no longer in data
    for (const [id, el] of this.renderedItems) {
      if (!newIds.has(id)) {
        el.classList.add('news-item-exit');
        this.renderedItems.delete(id);
        const timer = setTimeout(() => {
          el.remove();
          this.pendingTimers.delete(timer);
        }, 200);
        this.pendingTimers.add(timer);
      }
    }

    // Add new items and reorder
    for (const item of items) {
      if (!this.renderedItems.has(item.id)) {
        const el = this.createItemElement(item, newItemIndex);
        this.renderedItems.set(item.id, el);
        newItemIndex++;
      }
      // Reorder: appendChild moves existing nodes
      const el = this.renderedItems.get(item.id)!;
      this.itemsContainer.appendChild(el);
    }
  }

  private createItemElement(item: SourceItem, staggerIndex: number): HTMLElement {
    const article = document.createElement('article');
    article.className = 'news-item news-item-enter';
    article.dataset.itemId = item.id;

    const reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reducedMotion) {
      article.style.animationDelay = `${staggerIndex * 50}ms`;
    }

    const link = document.createElement('a');
    link.href = DOMPurify.sanitize(item.url);
    link.target = '_blank';
    link.rel = 'noopener';

    const title = document.createElement('h4');
    title.className = 'news-item-title';
    title.textContent = item.title;

    link.appendChild(title);
    article.appendChild(link);

    const meta = document.createElement('div');
    meta.className = 'news-item-meta';

    const sourceSpan = document.createElement('span');
    sourceSpan.className = 'news-item-source';
    sourceSpan.textContent = item.source;
    meta.appendChild(sourceSpan);

    const timeEl = document.createElement('time');
    timeEl.className = 'news-item-time';
    timeEl.textContent = this.formatTime(item.timestamp);
    meta.appendChild(timeEl);

    if (item.sentiment) {
      const sentimentSpan = document.createElement('span');
      sentimentSpan.className = `news-item-sentiment sentiment-${item.sentiment}`;
      sentimentSpan.textContent = item.sentiment;
      meta.appendChild(sentimentSpan);
    }

    article.appendChild(meta);

    if (item.summary) {
      const summary = document.createElement('p');
      summary.className = 'news-item-summary';
      summary.textContent = item.summary.slice(0, 200);
      article.appendChild(summary);
    }

    // Remove entrance animation class after it completes
    const delay = staggerIndex * 50 + 300;
    const timer = setTimeout(() => {
      article.classList.remove('news-item-enter');
      this.pendingTimers.delete(timer);
    }, delay);
    this.pendingTimers.add(timer);

    return article;
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
    this.cleanupTimers();
    for (const timer of this.pendingTimers) clearTimeout(timer);
    this.pendingTimers.clear();
    this.renderedItems.clear();
    this.container.innerHTML = '';
  }
}
