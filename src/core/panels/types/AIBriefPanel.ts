import { PanelBase } from '../PanelBase.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export class AIBriefPanel extends PanelBase {
  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement, config: import('../PanelBase.js').PanelConfig) {
    super(container, config);
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
    this.showSkeleton(3);
  }

  update(data: unknown): void {
    if (!data || typeof data !== 'object') return;

    const maybeDegraded = data as { type?: string; message?: string };
    if (maybeDegraded.type === 'degraded' && maybeDegraded.message) {
      this.hideSkeleton();
      this.renderDegraded(maybeDegraded.message);
      this.hasReceivedData = true;
      return;
    }

    const briefData = data as { summary?: string; timestamp?: string };
    if (!briefData.summary) return; // Not AI brief data (e.g., source items from updateAll)

    this.markDataReceived();

    const contentEl = this.container.querySelector('.ai-brief-content');
    const timestampEl = this.container.querySelector('.ai-brief-timestamp');

    if (contentEl && briefData.summary) {
      const html = DOMPurify.sanitize(marked.parse(briefData.summary) as string);
      this.typeEffect(contentEl as HTMLElement, html);
    }

    if (timestampEl && briefData.timestamp) {
      timestampEl.textContent = `Updated: ${new Date(briefData.timestamp).toLocaleTimeString()}`;
    }
  }

  private typeEffect(container: HTMLElement, html: string): void {
    // Cancel any ongoing typing
    if (this.typingTimer !== null) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }

    // If reduced motion, set instantly
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      container.innerHTML = html;
      return;
    }

    // Set full HTML structure, then extract text nodes
    container.innerHTML = html;
    const textNodes = this.getTextNodes(container);
    const originalTexts = textNodes.map(n => n.textContent ?? '');
    const totalChars = originalTexts.reduce((sum, t) => sum + t.length, 0);

    if (totalChars === 0) return;

    // Clear all text
    for (const node of textNodes) {
      node.textContent = '';
    }

    // Add blinking cursor
    const cursor = document.createElement('span');
    cursor.className = 'ai-brief-cursor';
    cursor.textContent = '|';
    container.appendChild(cursor);

    let charIndex = 0;
    const intervalMs = 33; // ~30 chars/sec

    const type = () => {
      if (charIndex >= totalChars) {
        cursor.remove();
        this.typingTimer = null;
        return;
      }

      // Find which text node contains this char index
      let remaining = charIndex;
      for (let i = 0; i < textNodes.length; i++) {
        if (remaining < originalTexts[i].length) {
          textNodes[i].textContent = originalTexts[i].slice(0, remaining + 1);
          // Move cursor after current text node
          textNodes[i].parentNode?.insertBefore(cursor, textNodes[i].nextSibling);
          break;
        }
        remaining -= originalTexts[i].length;
        textNodes[i].textContent = originalTexts[i]; // fully reveal previous nodes
      }

      charIndex++;
      this.typingTimer = setTimeout(type, intervalMs);
    };

    type();
  }

  private getTextNodes(root: Node): Text[] {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.trim()) nodes.push(node);
    }
    return nodes;
  }

  destroy(): void {
    this.cleanupTimers();
    if (this.typingTimer !== null) clearTimeout(this.typingTimer);
    this.container.innerHTML = '';
  }
}
