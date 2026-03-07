export interface PanelConfig {
  name: string;
  type: string;
  displayName: string;
  position: number;
  config: Record<string, unknown>;
}

export abstract class PanelBase {
  protected container: HTMLElement;
  protected config: PanelConfig;
  protected hasReceivedData = false;
  private panelElement: HTMLElement | null = null;
  private pulseTimer: ReturnType<typeof setTimeout> | null = null;
  private skeletonTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement, config: PanelConfig) {
    this.container = container;
    this.config = config;
  }

  abstract render(): void;
  abstract update(data: unknown): void;
  abstract destroy(): void;

  getName(): string { return this.config.name; }
  getDisplayName(): string { return this.config.displayName; }
  getPosition(): number { return this.config.position; }

  setPanelElement(el: HTMLElement): void {
    this.panelElement = el;
  }

  protected triggerPulse(): void {
    if (!this.panelElement) return;
    const header = this.panelElement.querySelector('.forge-panel-header') as HTMLElement | null;
    if (!header) return;
    if (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (this.pulseTimer !== null) clearTimeout(this.pulseTimer);
    header.classList.remove('pulse');
    void header.offsetWidth; // force reflow to restart animation
    header.classList.add('pulse');
    this.pulseTimer = setTimeout(() => {
      header.classList.remove('pulse');
      this.pulseTimer = null;
    }, 1500);
  }

  protected showSkeleton(lineCount = 3): void {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-container';
    const extraWidths = [null, 'skeleton-line-medium', 'skeleton-line-short'];
    for (let i = 0; i < lineCount; i++) {
      const line = document.createElement('div');
      line.classList.add('skeleton-block', 'skeleton-line');
      const extra = extraWidths[i % 3];
      if (extra) line.classList.add(extra);
      skeleton.appendChild(line);
    }
    this.container.prepend(skeleton);
  }

  protected hideSkeleton(): void {
    const skeleton = this.container.querySelector('.skeleton-container');
    if (!skeleton) return;
    if (this.skeletonTimer !== null) clearTimeout(this.skeletonTimer);
    skeleton.classList.add('loaded');
    this.skeletonTimer = setTimeout(() => {
      skeleton.remove();
      this.skeletonTimer = null;
    }, 300);
  }

  protected cleanupTimers(): void {
    if (this.pulseTimer !== null) { clearTimeout(this.pulseTimer); this.pulseTimer = null; }
    if (this.skeletonTimer !== null) { clearTimeout(this.skeletonTimer); this.skeletonTimer = null; }
  }

  protected markDataReceived(): void {
    if (!this.hasReceivedData) {
      this.hasReceivedData = true;
      this.hideSkeleton();
    }
    this.triggerPulse();
  }

  protected createElement(tag: string, className?: string, innerHTML?: string): HTMLElement {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  }
}
