import type { SourceBase, SourceItem, SourceConfig } from './SourceBase.js';
import type { SourceHealth } from './SourceHealth.js';
import { createSource } from './source-registry.js';

const MAX_BACKOFF_SECONDS = 300;

export class SourceManager {
  private sources = new Map<string, SourceBase>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private listeners: Array<(items: SourceItem[], sourceName: string) => void> = [];
  private health = new Map<string, SourceHealth>();
  private healthListeners: Array<(health: Map<string, SourceHealth>) => void> = [];

  initialize(configs: SourceConfig[]): void {
    for (const config of configs) {
      try {
        const source = createSource(config);
        this.sources.set(config.name, source);
        this.health.set(config.name, {
          status: 'online',
          lastSuccess: null,
          lastError: null,
          consecutiveFailures: 0,
        });
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
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  onItems(listener: (items: SourceItem[], sourceName: string) => void): void {
    this.listeners.push(listener);
  }

  onHealth(listener: (health: Map<string, SourceHealth>) => void): void {
    this.healthListeners.push(listener);
  }

  getHealth(): Map<string, SourceHealth> {
    return new Map(this.health);
  }

  async fetchAll(): Promise<SourceItem[]> {
    const allItems: SourceItem[] = [];
    const promises = Array.from(this.sources.entries()).map(async ([name, source]) => {
      try {
        const items = await source.fetchWithCache();
        allItems.push(...items);
        this.notifyListeners(items, name);
        this.recordSuccess(name);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`Error fetching source "${name}":`, errMsg);
        this.recordFailure(name, errMsg);
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
    const poll = async () => {
      try {
        const items = await source.fetchWithCache();
        this.notifyListeners(items, name);
        this.recordSuccess(name);
        const timer = setTimeout(poll, source.getInterval() * 1000);
        this.timers.set(name, timer);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`Fetch failed for "${name}":`, errMsg);
        this.recordFailure(name, errMsg);
        const health = this.health.get(name)!;
        const backoffSeconds = Math.min(
          source.getInterval() * Math.pow(2, health.consecutiveFailures),
          MAX_BACKOFF_SECONDS,
        );
        const timer = setTimeout(poll, backoffSeconds * 1000);
        this.timers.set(name, timer);
      }
    };

    poll();
  }

  private recordSuccess(name: string): void {
    const prev = this.health.get(name);
    if (!prev) return;
    this.health.set(name, {
      status: 'online',
      lastSuccess: new Date(),
      lastError: prev.lastError,
      consecutiveFailures: 0,
    });
    this.notifyHealthListeners();
  }

  private recordFailure(name: string, error: string): void {
    const prev = this.health.get(name);
    if (!prev) return;
    const failures = prev.consecutiveFailures + 1;
    this.health.set(name, {
      status: failures >= 3 ? 'offline' : 'degraded',
      lastSuccess: prev.lastSuccess,
      lastError: error,
      consecutiveFailures: failures,
    });
    this.notifyHealthListeners();
  }

  private notifyListeners(items: SourceItem[], sourceName: string): void {
    for (const listener of this.listeners) {
      listener(items, sourceName);
    }
  }

  private notifyHealthListeners(): void {
    const snapshot = new Map(this.health);
    for (const listener of this.healthListeners) {
      listener(snapshot);
    }
  }
}
