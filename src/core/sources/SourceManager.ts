import type { SourceBase, SourceItem, SourceConfig } from './SourceBase.js';
import type { SourceHealth } from './SourceHealth.js';
import { createSource } from './source-registry.js';
import { SourceScheduler, Semaphore, type SchedulerOptions } from './scheduler.js';

export class SourceManager {
  private sources = new Map<string, SourceBase>();
  private listeners: Array<(items: SourceItem[], sourceName: string) => void> = [];
  private health = new Map<string, SourceHealth>();
  private healthListeners: Array<(health: Map<string, SourceHealth>) => void> = [];
  private scheduler: SourceScheduler;

  constructor(schedulerOptions?: SchedulerOptions) {
    this.scheduler = new SourceScheduler(schedulerOptions);
  }

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
    this.scheduler.start(this.sources, {
      onFetchStart: () => {
        // Intentionally empty; reserved for future metrics/logging
      },
      onFetchComplete: (sourceName, items) => {
        this.notifyListeners(items, sourceName);
        this.recordSuccess(sourceName);
      },
      onFetchError: (sourceName, error) => {
        console.warn(`Fetch failed for "${sourceName}":`, error);
        this.recordFailure(sourceName, error);
      },
    });
  }

  stopAll(): void {
    this.scheduler.stop();
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
    const semaphore = new Semaphore(5);
    const promises = Array.from(this.sources.entries()).map(async ([name, source]) => {
      await semaphore.acquire();
      try {
        const items = await source.fetchWithCache();
        allItems.push(...items);
        this.notifyListeners(items, name);
        this.recordSuccess(name);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`Error fetching source "${name}":`, errMsg);
        this.recordFailure(name, errMsg);
      } finally {
        semaphore.release();
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
