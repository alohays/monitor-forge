import type { PanelBase, PanelConfig } from './PanelBase.js';

type PanelConstructor = new (container: HTMLElement, config: PanelConfig) => PanelBase;

const registry = new Map<string, PanelConstructor>();

export function registerPanelType(type: string, cls: PanelConstructor): void {
  registry.set(type, cls);
}

export function createPanel(container: HTMLElement, config: PanelConfig): PanelBase {
  const key = config.type === 'custom' ? config.name : config.type;
  const cls = registry.get(key);
  if (!cls) throw new Error(`Unknown panel type: ${key}`);
  return new cls(container, config);
}

export function getRegisteredPanelTypes(): string[] {
  return Array.from(registry.keys());
}
