import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourceScheduler, Semaphore, type SchedulerCallbacks } from '../scheduler.js';
import { SourceBase, type SourceItem, type SourceConfig } from '../SourceBase.js';
import { SourceManager } from '../SourceManager.js';
import { registerSource } from '../source-registry.js';

// ─── Mock Source ────────────────────────────────────

class MockSource extends SourceBase {
  items: SourceItem[] = [];
  shouldThrow = false;
  fetchDelay = 0;

  async fetch(): Promise<SourceItem[]> {
    if (this.fetchDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.fetchDelay));
    }
    if (this.shouldThrow) throw new Error('mock error');
    return this.items;
  }
}

const makeConfig = (name: string, interval = 300): SourceConfig => ({
  name,
  type: 'mock-sched',
  url: 'https://example.com',
  interval,
  category: 'test',
  tier: 3,
  tags: [],
  language: 'en',
  authHeader: 'Authorization',
  cacheTtl: 0, // disable cache for scheduler tests
});

function makeItem(id: string, source: string): SourceItem {
  return {
    id,
    title: `Item ${id}`,
    url: `https://example.com/${id}`,
    source,
    category: 'test',
    timestamp: new Date(),
  };
}

function makeCallbacks(overrides?: Partial<SchedulerCallbacks>): SchedulerCallbacks {
  return {
    onFetchStart: overrides?.onFetchStart ?? vi.fn(),
    onFetchComplete: overrides?.onFetchComplete ?? vi.fn(),
    onFetchError: overrides?.onFetchError ?? vi.fn(),
  };
}

// ─── Tests ──────────────────────────────────────────

beforeEach(() => {
  registerSource('mock-sched', MockSource);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SourceScheduler', () => {
  // 1. Stagger: initial fetches are spread across the interval
  it('staggers initial fetches across the polling interval', async () => {
    // Use jitterPercent: 0 for deterministic timing
    const scheduler = new SourceScheduler({ maxConcurrent: 20, jitterPercent: 0 });
    const sources = new Map<string, SourceBase>();
    const count = 5;
    const interval = 300; // 300s
    for (let i = 0; i < count; i++) {
      const cfg = makeConfig(`src-${i}`, interval);
      const src = new MockSource(cfg);
      src.items = [makeItem(`item-${i}`, `src-${i}`)];
      sources.set(`src-${i}`, src);
    }

    const fetchStartNames: string[] = [];
    const callbacks = makeCallbacks({
      onFetchStart: vi.fn((name: string) => {
        fetchStartNames.push(name);
      }),
      onFetchComplete: vi.fn(),
    });

    scheduler.start(sources, callbacks);

    // Stagger = 300s / 5 = 60s apart
    // At t=0: src-0 fires
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchStartNames).toEqual(['src-0']);

    // At t=60s: src-1 fires
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchStartNames).toEqual(['src-0', 'src-1']);

    // At t=120s: src-2 fires
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchStartNames).toEqual(['src-0', 'src-1', 'src-2']);

    // At t=180s: src-3 fires
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchStartNames).toEqual(['src-0', 'src-1', 'src-2', 'src-3']);

    // At t=240s: src-4 fires
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchStartNames).toEqual(['src-0', 'src-1', 'src-2', 'src-3', 'src-4']);

    // All 5 initial fetches completed, staggered 60s apart (not all at t=0)
    expect(fetchStartNames.length).toBe(count);

    scheduler.stop();
  });

  // 2. Jitter: poll intervals vary within +-10%
  it('applies jitter to poll intervals', async () => {
    // Seed Math.random to produce predictable jitter values
    const randomValues = [0.0, 1.0, 0.5, 0.25, 0.75];
    let callIdx = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      const val = randomValues[callIdx % randomValues.length];
      callIdx++;
      return val;
    });

    const scheduler = new SourceScheduler({ maxConcurrent: 5, jitterPercent: 10 });
    const sources = new Map<string, SourceBase>();
    const cfg = makeConfig('jitter-src', 100); // 100s interval
    const src = new MockSource(cfg);
    src.items = [makeItem('j1', 'jitter-src')];
    sources.set('jitter-src', src);

    const completeTimes: number[] = [];
    const callbacks = makeCallbacks({
      onFetchComplete: vi.fn(() => {
        completeTimes.push(Date.now());
      }),
    });

    scheduler.start(sources, callbacks);

    // First fetch fires at t=0 (stagger=0 for single source)
    await vi.advanceTimersByTimeAsync(0);
    expect(completeTimes.length).toBe(1);

    // Next poll: 100s * jitterFactor. With Math.random()=0.0 -> factor = 1 + ((0*2-1)*10)/100 = 0.9 -> 90s
    await vi.advanceTimersByTimeAsync(90_000);
    expect(completeTimes.length).toBe(2);

    scheduler.stop();
    vi.spyOn(Math, 'random').mockRestore();
  });

  // 3. Concurrency: max 5 concurrent fetches when 10+ sources fire
  it('limits concurrent fetches to maxConcurrent', async () => {
    let activeFetches = 0;
    let peakConcurrency = 0;

    const scheduler = new SourceScheduler({ maxConcurrent: 5, staggerMs: 0 });
    const sources = new Map<string, SourceBase>();

    for (let i = 0; i < 10; i++) {
      const cfg = makeConfig(`conc-${i}`, 600);
      const src = new MockSource(cfg);
      src.items = [makeItem(`c-${i}`, `conc-${i}`)];
      // Simulate slow fetches
      src.fetchDelay = 50;
      sources.set(`conc-${i}`, src);
    }

    const callbacks = makeCallbacks({
      onFetchStart: vi.fn(() => {
        activeFetches++;
        peakConcurrency = Math.max(peakConcurrency, activeFetches);
      }),
      onFetchComplete: vi.fn(() => {
        activeFetches--;
      }),
    });

    scheduler.start(sources, callbacks);

    // All 10 sources fire at t=0 (staggerMs=0), but only 5 should run concurrently
    // Advance time to let fetches complete (50ms delay each)
    await vi.advanceTimersByTimeAsync(0);
    // Let the delayed fetches resolve
    await vi.advanceTimersByTimeAsync(100);

    expect(peakConcurrency).toBeLessThanOrEqual(5);
    expect((callbacks.onFetchComplete as ReturnType<typeof vi.fn>).mock.calls.length).toBe(10);

    scheduler.stop();
  });

  // 4. Backoff: failure increases next poll interval (2x, 4x, 8x cap)
  it('applies exponential backoff on failure', async () => {
    const scheduler = new SourceScheduler({ maxConcurrent: 5, jitterPercent: 0 });
    const sources = new Map<string, SourceBase>();
    const interval = 60; // 60s
    const cfg = makeConfig('backoff-src', interval);
    const src = new MockSource(cfg);
    src.shouldThrow = true;
    sources.set('backoff-src', src);

    const errorSpy = vi.fn();
    const callbacks = makeCallbacks({ onFetchError: errorSpy });

    scheduler.start(sources, callbacks);

    // 1st fetch at t=0 -> failure -> backoff = 60 * 2^1 = 120s
    await vi.advanceTimersByTimeAsync(0);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // 2nd fetch at t=120s -> failure -> backoff = 60 * 2^2 = 240s
    await vi.advanceTimersByTimeAsync(120_000);
    expect(errorSpy).toHaveBeenCalledTimes(2);

    // 3rd fetch at t=360s -> failure -> backoff = 60 * 2^3 = 480s (but cap = 60*8=480, so equal)
    await vi.advanceTimersByTimeAsync(240_000);
    expect(errorSpy).toHaveBeenCalledTimes(3);

    // 4th fetch at t=840s -> failure -> backoff capped at 60*8 = 480s
    await vi.advanceTimersByTimeAsync(480_000);
    expect(errorSpy).toHaveBeenCalledTimes(4);

    // Verify cap: next fetch should also be 480s (not 60*2^4=960)
    const status = scheduler.getStatus().get('backoff-src')!;
    // The next fetch should be ~480s from now
    const expectedDelay = interval * 8 * 1000; // 480_000ms
    const timeDiff = status.nextFetch - Date.now();
    expect(timeDiff).toBeLessThanOrEqual(expectedDelay);

    scheduler.stop();
  });

  // 5. Backoff: success resets to normal interval
  it('resets backoff to normal interval after success', async () => {
    const scheduler = new SourceScheduler({ maxConcurrent: 5, jitterPercent: 0 });
    const sources = new Map<string, SourceBase>();
    const interval = 60;
    const cfg = makeConfig('reset-src', interval);
    const src = new MockSource(cfg);
    src.shouldThrow = true;
    sources.set('reset-src', src);

    const errorSpy = vi.fn();
    const completeSpy = vi.fn();
    const callbacks = makeCallbacks({
      onFetchError: errorSpy,
      onFetchComplete: completeSpy,
    });

    scheduler.start(sources, callbacks);

    // 1st fetch fails -> backoff = 120s
    await vi.advanceTimersByTimeAsync(0);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // Recover
    src.shouldThrow = false;
    src.items = [makeItem('ok', 'reset-src')];

    // 2nd fetch at 120s -> success
    await vi.advanceTimersByTimeAsync(120_000);
    expect(completeSpy).toHaveBeenCalledTimes(1);

    // After success, errors should be reset
    const status = scheduler.getStatus().get('reset-src')!;
    expect(status.errors).toBe(0);

    // Next fetch should be at normal interval (60s), not backoff
    const timeDiff = status.nextFetch - Date.now();
    expect(timeDiff).toBeLessThanOrEqual(interval * 1000);
    expect(timeDiff).toBeGreaterThan(0);

    scheduler.stop();
  });

  // 6. Stop: all timers cleared, no further fetches
  it('clears all timers on stop and prevents further fetches', async () => {
    const scheduler = new SourceScheduler({ maxConcurrent: 5 });
    const sources = new Map<string, SourceBase>();
    const cfg = makeConfig('stop-src', 60);
    const src = new MockSource(cfg);
    src.items = [makeItem('s1', 'stop-src')];
    sources.set('stop-src', src);

    const completeSpy = vi.fn();
    const callbacks = makeCallbacks({ onFetchComplete: completeSpy });

    scheduler.start(sources, callbacks);
    await vi.advanceTimersByTimeAsync(0); // first fetch
    expect(completeSpy).toHaveBeenCalledTimes(1);

    scheduler.stop();
    expect(vi.getTimerCount()).toBe(0);

    // Advance time — no more fetches
    await vi.advanceTimersByTimeAsync(600_000);
    expect(completeSpy).toHaveBeenCalledTimes(1);
  });

  // 7. Start/stop/start: scheduler can be restarted cleanly
  it('can be restarted cleanly after stop', async () => {
    const scheduler = new SourceScheduler({ maxConcurrent: 5 });
    const sources = new Map<string, SourceBase>();
    const cfg = makeConfig('restart-src', 60);
    const src = new MockSource(cfg);
    src.items = [makeItem('r1', 'restart-src')];
    sources.set('restart-src', src);

    const completeSpy = vi.fn();
    const callbacks = makeCallbacks({ onFetchComplete: completeSpy });

    // First start
    scheduler.start(sources, callbacks);
    await vi.advanceTimersByTimeAsync(0);
    expect(completeSpy).toHaveBeenCalledTimes(1);

    // Stop
    scheduler.stop();
    expect(vi.getTimerCount()).toBe(0);

    // Restart
    scheduler.start(sources, callbacks);
    await vi.advanceTimersByTimeAsync(0);
    expect(completeSpy).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  // 8. Callbacks: onFetchComplete called with correct items
  it('calls onFetchComplete with correct items', async () => {
    const scheduler = new SourceScheduler({ maxConcurrent: 5 });
    const sources = new Map<string, SourceBase>();
    const cfg = makeConfig('items-src', 60);
    const src = new MockSource(cfg);
    const expectedItems = [makeItem('x1', 'items-src'), makeItem('x2', 'items-src')];
    src.items = expectedItems;
    sources.set('items-src', src);

    const completeSpy = vi.fn();
    const callbacks = makeCallbacks({ onFetchComplete: completeSpy });

    scheduler.start(sources, callbacks);
    await vi.advanceTimersByTimeAsync(0);

    expect(completeSpy).toHaveBeenCalledTimes(1);
    expect(completeSpy).toHaveBeenCalledWith('items-src', expectedItems);

    scheduler.stop();
  });

  // 9. Callbacks: onFetchError called on failure
  it('calls onFetchError on failure with error message', async () => {
    const scheduler = new SourceScheduler({ maxConcurrent: 5 });
    const sources = new Map<string, SourceBase>();
    const cfg = makeConfig('err-src', 60);
    const src = new MockSource(cfg);
    src.shouldThrow = true;
    sources.set('err-src', src);

    const errorSpy = vi.fn();
    const callbacks = makeCallbacks({ onFetchError: errorSpy });

    scheduler.start(sources, callbacks);
    await vi.advanceTimersByTimeAsync(0);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('err-src', 'mock error');

    scheduler.stop();
  });

  // 10. Integration: SourceManager.startAll() uses scheduler (verify stagger behavior)
  it('SourceManager.startAll() uses scheduler with stagger', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new SourceManager();
    const interval = 300; // 300s
    manager.initialize([
      makeConfig('int-a', interval),
      makeConfig('int-b', interval),
      makeConfig('int-c', interval),
    ]);

    const srcA = manager.getSource('int-a') as MockSource;
    const srcB = manager.getSource('int-b') as MockSource;
    const srcC = manager.getSource('int-c') as MockSource;
    srcA.items = [makeItem('a1', 'int-a')];
    srcB.items = [makeItem('b1', 'int-b')];
    srcC.items = [makeItem('c1', 'int-c')];

    const listener = vi.fn();
    manager.onItems(listener);
    manager.startAll();

    // Stagger = 300s / 3 = 100s between sources
    // At t=0: first source fetches
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(1);

    // At t=100s: second source fetches
    await vi.advanceTimersByTimeAsync(100_000);
    expect(listener).toHaveBeenCalledTimes(2);

    // At t=200s: third source fetches
    await vi.advanceTimersByTimeAsync(100_000);
    expect(listener).toHaveBeenCalledTimes(3);

    manager.stopAll();
    expect(vi.getTimerCount()).toBe(0);
    warnSpy.mockRestore();
  });
});

describe('Semaphore', () => {
  it('allows up to max concurrent acquisitions', async () => {
    const sem = new Semaphore(2);
    await sem.acquire();
    await sem.acquire();

    // Third acquire should block
    let thirdResolved = false;
    const thirdPromise = sem.acquire().then(() => {
      thirdResolved = true;
    });

    // Verify it hasn't resolved yet
    await Promise.resolve();
    expect(thirdResolved).toBe(false);

    // Release one slot
    sem.release();
    await thirdPromise;
    expect(thirdResolved).toBe(true);
  });
});
