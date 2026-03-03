import { PanelBase } from '../PanelBase.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export class AIBriefPanel extends PanelBase {
  private refreshInterval: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(container: HTMLElement, config: import('../PanelBase.js').PanelConfig) {
    super(container, config);
    this.refreshInterval = (config.config.refreshInterval as number) ?? 300;
  }

  render(): void {
    this.container.innerHTML = `
      <div class="ai-brief">
        <div class="ai-brief-content">
          <p class="ai-brief-placeholder">Waiting for AI analysis...</p>
        </div>
        <div class="ai-brief-meta">
          <span class="ai-brief-timestamp"></span>
        </div>
      </div>
    `;
  }

  update(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const briefData = data as { summary?: string; timestamp?: string };

    const contentEl = this.container.querySelector('.ai-brief-content');
    const timestampEl = this.container.querySelector('.ai-brief-timestamp');

    if (contentEl && briefData.summary) {
      const html = marked.parse(briefData.summary) as string;
      contentEl.innerHTML = DOMPurify.sanitize(html);
    }

    if (timestampEl && briefData.timestamp) {
      timestampEl.textContent = `Updated: ${new Date(briefData.timestamp).toLocaleTimeString()}`;
    }
  }

  destroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.container.innerHTML = '';
  }
}
