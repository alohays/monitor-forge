import type { SourceBase, SourceItem, SourceConfig } from './SourceBase.js';
import { createSource } from './source-registry.js';

export class SourceManager {
  private sources = new Map<string, SourceBase>();
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private listeners: Array<(items: SourceItem[], sourceName: string) => void> = [];

  initialize(configs: SourceConfig[]): void {
    for (const config of configs) {
      try {
        const source = createSource(config);
        this.sources.set(config.name, source);
      } catch (err) {
        console.warn(`Failed to create source "${config.name}":`, err);
      }
    }
  }

  startAll(): void {
    for (const [name, source] of this.sources) {
      this.startSource(name, source);
    }
  }

  stopAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  onItems(listener: (items: SourceItem[], sourceName: string) => void): void {
    this.listeners.push(listener);
  }

  async fetchAll(): Promise<SourceItem[]> {
    const allItems: SourceItem[] = [];
    const promises = Array.from(this.sources.entries()).map(async ([name, source]) => {
      try {
        const items = await source.fetchWithCache();
        allItems.push(...items);
        this.notifyListeners(items, name);
      } catch (err) {
        console.warn(`Error fetching source "${name}":`, err);
      }
    });
    await Promise.allSettled(promises);
    return allItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getSource(name: string): SourceBase | undefined {
    return this.sources.get(name);
  }

  getSourceNames(): string[] {
    return Array.from(this.sources.keys());
  }

  private startSource(name: string, source: SourceBase): void {
    // Initial fetch
    source.fetchWithCache().then(items => {
      this.notifyListeners(items, name);
    }).catch(err => {
      console.warn(`Initial fetch failed for "${name}":`, err);
    });

    // Set up periodic refresh
    const timer = setInterval(async () => {
      try {
        const items = await source.fetchWithCache();
        this.notifyListeners(items, name);
      } catch (err) {
        console.warn(`Refresh failed for "${name}":`, err);
      }
    }, source.getInterval() * 1000);

    this.timers.set(name, timer);
  }

  private notifyListeners(items: SourceItem[], sourceName: string): void {
    for (const listener of this.listeners) {
      listener(items, sourceName);
    }
  }
}
