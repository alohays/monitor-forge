import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourceManager } from './SourceManager.js';
import { registerSource } from './source-registry.js';
import { SourceBase, type SourceItem, type SourceConfig } from './SourceBase.js';

class MockSource extends SourceBase {
  items: SourceItem[] = [];
  shouldThrow = false;
  async fetch(): Promise<SourceItem[]> {
    if (this.shouldThrow) throw new Error('mock error');
    return this.items;
  }
}

const makeConfig = (name: string, interval = 3600): SourceConfig => ({
  name, type: 'mock-mgr', url: 'https://example.com',
  interval, category: 'test', tier: 3, tags: [], language: 'en',
  authHeader: 'Authorization', cacheTtl: 300,
});

beforeEach(() => {
  registerSource('mock-mgr', MockSource);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SourceManager', () => {
  it('initializes sources from config array', () => {
    const manager = new SourceManager();
    manager.initialize([makeConfig('src-1'), makeConfig('src-2')]);
    expect(manager.getSourceNames()).toEqual(['src-1', 'src-2']);
  });

  it('skips sources with unknown types gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new SourceManager();
    manager.initialize([{ ...makeConfig('bad'), type: 'nonexistent' }]);
    expect(manager.getSourceNames()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('fetchAll aggregates from all sources', async () => {
    const manager = new SourceManager();
    manager.initialize([makeConfig('a'), makeConfig('b')]);

    // Set up mock data on the created sources
    const srcA = manager.getSource('a') as MockSource;
    const srcB = manager.getSource('b') as MockSource;
    srcA.items = [{ id: '1', title: 'A', url: '', source: 'a', category: 'test', timestamp: new Date('2024-01-02') }];
    srcB.items = [{ id: '2', title: 'B', url: '', source: 'b', category: 'test', timestamp: new Date('2024-01-01') }];

    const items = await manager.fetchAll();
    expect(items).toHaveLength(2);
  });

  it('sorts items by timestamp descending', async () => {
    const manager = new SourceManager();
    manager.initialize([makeConfig('c')]);
    const src = manager.getSource('c') as MockSource;
    src.items = [
      { id: 'old', title: 'Old', url: '', source: 'c', category: 'test', timestamp: new Date('2024-01-01') },
      { id: 'new', title: 'New', url: '', source: 'c', category: 'test', timestamp: new Date('2024-01-03') },
    ];

    const items = await manager.fetchAll();
    expect(items[0].id).toBe('new');
    expect(items[1].id).toBe('old');
  });

  it('notifies listeners on fetch', async () => {
    const manager = new SourceManager();
    manager.initialize([makeConfig('d')]);
    const src = manager.getSource('d') as MockSource;
    src.items = [{ id: '1', title: 'X', url: '', source: 'd', category: 'test', timestamp: new Date() }];

    const listener = vi.fn();
    manager.onItems(listener);
    await manager.fetchAll();
    expect(listener).toHaveBeenCalled();
  });

  it('stopAll clears all timers', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new SourceManager();
    manager.initialize([makeConfig('e')]);
    manager.startAll();
    // Flush microtasks so the initial poll() resolves and sets setTimeout
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    manager.stopAll();
    expect(vi.getTimerCount()).toBe(0);
    // Advance time — no callbacks should fire (no errors thrown)
    await vi.advanceTimersByTimeAsync(7200_000);
    warnSpy.mockRestore();
  });

  // ─── Health Tracking ───────────────────────────────

  it('records health as online after successful fetch', async () => {
    const manager = new SourceManager();
    manager.initialize([makeConfig('h1')]);
    const src = manager.getSource('h1') as MockSource;
    src.items = [{ id: '1', title: 'X', url: '', source: 'h1', category: 'test', timestamp: new Date() }];

    await manager.fetchAll();
    const health = manager.getHealth().get('h1')!;
    expect(health.status).toBe('online');
    expect(health.consecutiveFailures).toBe(0);
    expect(health.lastSuccess).toBeInstanceOf(Date);
  });

  it('records health as degraded after 1 failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new SourceManager();
    manager.initialize([makeConfig('h2')]);
    const src = manager.getSource('h2') as MockSource;
    src.shouldThrow = true;

    await manager.fetchAll();
    const health = manager.getHealth().get('h2')!;
    expect(health.status).toBe('degraded');
    expect(health.consecutiveFailures).toBe(1);
    expect(health.lastError).toBe('mock error');
    warnSpy.mockRestore();
  });

  it('records health as offline after 3 consecutive failures', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new SourceManager();
    manager.initialize([makeConfig('h3')]);
    const src = manager.getSource('h3') as MockSource;
    src.shouldThrow = true;

    await manager.fetchAll();
    await manager.fetchAll();
    await manager.fetchAll();
    const health = manager.getHealth().get('h3')!;
    expect(health.status).toBe('offline');
    expect(health.consecutiveFailures).toBe(3);
    warnSpy.mockRestore();
  });

  it('resets health to online after recovery', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new SourceManager();
    manager.initialize([makeConfig('h4')]);
    const src = manager.getSource('h4') as MockSource;
    src.items = [{ id: '1', title: 'X', url: '', source: 'h4', category: 'test', timestamp: new Date() }];

    src.shouldThrow = true;
    await manager.fetchAll();
    await manager.fetchAll();
    expect(manager.getHealth().get('h4')!.status).toBe('degraded');

    src.shouldThrow = false;
    await manager.fetchAll();
    const health = manager.getHealth().get('h4')!;
    expect(health.status).toBe('online');
    expect(health.consecutiveFailures).toBe(0);
    warnSpy.mockRestore();
  });

  it('notifies health listeners on status change', async () => {
    const manager = new SourceManager();
    manager.initialize([makeConfig('h5')]);
    const src = manager.getSource('h5') as MockSource;
    src.items = [{ id: '1', title: 'X', url: '', source: 'h5', category: 'test', timestamp: new Date() }];

    const healthListener = vi.fn();
    manager.onHealth(healthListener);

    await manager.fetchAll();
    expect(healthListener).toHaveBeenCalledTimes(1);
    const healthMap = healthListener.mock.calls[0][0] as Map<string, unknown>;
    expect(healthMap).toBeInstanceOf(Map);
    expect(healthMap.has('h5')).toBe(true);
  });

  it('uses exponential backoff on failure in startSource', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const manager = new SourceManager();
    const interval = 60; // 60 seconds
    manager.initialize([makeConfig('h6', interval)]);
    const src = manager.getSource('h6') as MockSource;
    src.shouldThrow = true;

    manager.startAll();

    // Initial poll runs immediately (microtask)
    await vi.advanceTimersByTimeAsync(0);
    // After 1st failure: backoff = 60 * 2^1 = 120s
    expect(manager.getHealth().get('h6')!.consecutiveFailures).toBe(1);

    // Advance 120s for the 2nd poll
    await vi.advanceTimersByTimeAsync(120_000);
    // After 2nd failure: backoff = 60 * 2^2 = 240s
    expect(manager.getHealth().get('h6')!.consecutiveFailures).toBe(2);

    // Advance 240s for the 3rd poll
    await vi.advanceTimersByTimeAsync(240_000);
    expect(manager.getHealth().get('h6')!.consecutiveFailures).toBe(3);
    expect(manager.getHealth().get('h6')!.status).toBe('offline');

    manager.stopAll();
    warnSpy.mockRestore();
  });
});
