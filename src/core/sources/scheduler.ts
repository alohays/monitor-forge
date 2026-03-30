import type { SourceBase, SourceItem } from './SourceBase.js';

export interface SchedulerOptions {
  maxConcurrent?: number;  // default: 5
  jitterPercent?: number;  // default: 10 (+-10%)
  staggerMs?: number;      // default: auto-calculated from source count
}

export interface SchedulerCallbacks {
  onFetchStart: (sourceName: string) => void;
  onFetchComplete: (sourceName: string, items: SourceItem[]) => void;
  onFetchError: (sourceName: string, error: string) => void;
}

interface SourceState {
  nextFetch: number;
  lastFetch: number | null;
  errors: number;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Simple counting semaphore for concurrency control.
 * Callers await acquire() before performing work and call release() when done.
 */
export class Semaphore {
  private current = 0;
  private waiting: Array<() => void> = [];

  constructor(private readonly max: number) {}

  acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    const next = this.waiting.shift();
    if (next) {
      // Hand the slot directly to the next waiter
      next();
    } else {
      this.current--;
    }
  }
}

/**
 * Manages polling timers with stagger, jitter, and concurrency control.
 * Replaces the ad-hoc per-source setTimeout loop in SourceManager.
 */
export class SourceScheduler {
  private readonly maxConcurrent: number;
  private readonly jitterPercent: number;
  private readonly staggerMs: number | undefined;
  private states = new Map<string, SourceState>();
  private semaphore: Semaphore;
  private running = false;

  constructor(options: SchedulerOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 5;
    this.jitterPercent = options.jitterPercent ?? 10;
    this.staggerMs = options.staggerMs;
    this.semaphore = new Semaphore(this.maxConcurrent);
  }

  start(sources: Map<string, SourceBase>, callbacks: SchedulerCallbacks): void {
    this.stop();
    this.running = true;
    this.semaphore = new Semaphore(this.maxConcurrent);

    const sourceCount = sources.size;
    if (sourceCount === 0) return;

    // Compute stagger: spread initial fetches across the smallest polling interval
    let minInterval = Infinity;
    for (const source of sources.values()) {
      minInterval = Math.min(minInterval, source.getInterval());
    }
    const staggerMs = this.staggerMs ?? Math.floor((minInterval * 1000) / sourceCount);

    let index = 0;
    for (const [name, source] of sources) {
      const delayMs = staggerMs * index;
      const state: SourceState = {
        nextFetch: Date.now() + delayMs,
        lastFetch: null,
        errors: 0,
        timer: null,
      };
      this.states.set(name, state);

      state.timer = setTimeout(() => {
        this.poll(name, source, callbacks);
      }, delayMs);

      index++;
    }
  }

  stop(): void {
    this.running = false;
    for (const state of this.states.values()) {
      if (state.timer !== null) {
        clearTimeout(state.timer);
        state.timer = null;
      }
    }
    this.states.clear();
  }

  getStatus(): Map<string, { nextFetch: number; lastFetch: number | null; errors: number }> {
    const result = new Map<string, { nextFetch: number; lastFetch: number | null; errors: number }>();
    for (const [name, state] of this.states) {
      result.set(name, {
        nextFetch: state.nextFetch,
        lastFetch: state.lastFetch,
        errors: state.errors,
      });
    }
    return result;
  }

  private async poll(
    name: string,
    source: SourceBase,
    callbacks: SchedulerCallbacks,
  ): Promise<void> {
    if (!this.running) return;

    await this.semaphore.acquire();
    if (!this.running) {
      this.semaphore.release();
      return;
    }

    const state = this.states.get(name);
    if (!state) {
      this.semaphore.release();
      return;
    }

    callbacks.onFetchStart(name);

    try {
      const items = await source.fetchWithCache();
      this.semaphore.release();

      state.lastFetch = Date.now();
      state.errors = 0;
      callbacks.onFetchComplete(name, items);

      // Schedule next poll at normal interval with jitter
      this.scheduleNext(name, source, callbacks, source.getInterval() * 1000);
    } catch (err) {
      this.semaphore.release();

      const errMsg = err instanceof Error ? err.message : String(err);
      state.lastFetch = Date.now();
      state.errors++;
      callbacks.onFetchError(name, errMsg);

      // Exponential backoff: interval * 2^failures, capped at interval * 8
      const baseMs = source.getInterval() * 1000;
      const backoffMs = Math.min(
        baseMs * Math.pow(2, state.errors),
        baseMs * 8,
      );
      this.scheduleNext(name, source, callbacks, backoffMs);
    }
  }

  private scheduleNext(
    name: string,
    source: SourceBase,
    callbacks: SchedulerCallbacks,
    intervalMs: number,
  ): void {
    if (!this.running) return;

    const state = this.states.get(name);
    if (!state) return;

    // Apply jitter: +-jitterPercent%
    const jitterFactor = 1 + ((Math.random() * 2 - 1) * this.jitterPercent) / 100;
    const delayMs = Math.round(intervalMs * jitterFactor);

    state.nextFetch = Date.now() + delayMs;
    state.timer = setTimeout(() => {
      this.poll(name, source, callbacks);
    }, delayMs);
  }
}
