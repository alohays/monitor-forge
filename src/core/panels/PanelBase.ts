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

  protected createElement(tag: string, className?: string, innerHTML?: string): HTMLElement {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
  }
}
