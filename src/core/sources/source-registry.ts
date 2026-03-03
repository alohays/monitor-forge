import type { SourceBase } from './SourceBase.js';

type SourceConstructor = new (config: import('./SourceBase.js').SourceConfig) => SourceBase;

const registry = new Map<string, SourceConstructor>();

export function registerSource(type: string, cls: SourceConstructor): void {
  registry.set(type, cls);
}

export function createSource(config: import('./SourceBase.js').SourceConfig): SourceBase {
  const cls = registry.get(config.type);
  if (!cls) throw new Error(`Unknown source type: ${config.type}. Registered: ${Array.from(registry.keys()).join(', ')}`);
  return new cls(config);
}

export function getRegisteredSourceTypes(): string[] {
  return Array.from(registry.keys());
}
