import type { LayerPlugin } from './LayerBase.js';

type LayerPluginConstructor = new (config: import('./LayerBase.js').LayerConfig) => LayerPlugin;

const registry = new Map<string, LayerPluginConstructor>();

export function registerLayerType(type: string, cls: LayerPluginConstructor): void {
  registry.set(type, cls);
}

export function createLayerPlugin(config: import('./LayerBase.js').LayerConfig): LayerPlugin {
  const cls = registry.get(config.type);
  if (!cls) throw new Error(`Unknown layer type: ${config.type}`);
  return new cls(config);
}

export function getRegisteredLayerTypes(): string[] {
  return Array.from(registry.keys());
}
