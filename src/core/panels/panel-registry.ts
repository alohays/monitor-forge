import type { PanelBase, PanelConfig } from './PanelBase.js';

type PanelConstructor = new (container: HTMLElement, config: PanelConfig) => PanelBase;

const registry = new Map<string, PanelConstructor>();

export function registerPanelType(type: string, cls: PanelConstructor): void {
  registry.set(type, cls);
}

export function createPanel(container: HTMLElement, config: PanelConfig): PanelBase {
  const cls = registry.get(config.type);
  if (!cls) throw new Error(`Unknown panel type: ${config.type}`);
  return new cls(container, config);
}

export function getRegisteredPanelTypes(): string[] {
  return Array.from(registry.keys());
}
