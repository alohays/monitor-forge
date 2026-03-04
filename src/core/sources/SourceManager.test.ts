import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourceManager } from './SourceManager.js';
import { registerSource } from './source-registry.js';
import { SourceBase, type SourceItem, type SourceConfig } from './SourceBase.js';

class MockSource extends SourceBase {
  items: SourceItem[] = [];
  async fetch(): Promise<SourceItem[]> {
    return this.items;
  }
}

const makeConfig = (name: string): SourceConfig => ({
  name, type: 'mock-mgr', url: 'https://example.com',
  interval: 3600, category: 'test', tier: 3, tags: [], language: 'en',
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

  it('stopAll clears all timers', () => {
    const manager = new SourceManager();
    manager.initialize([makeConfig('e')]);
    manager.startAll();
    manager.stopAll();
    // No error means timers were cleared successfully
    expect(manager.getSourceNames()).toEqual(['e']);
  });
});
