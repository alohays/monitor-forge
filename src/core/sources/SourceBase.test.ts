import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SourceBase, type SourceItem, type SourceConfig } from './SourceBase.js';

const testConfig: SourceConfig = {
  name: 'test-source',
  type: 'test',
  url: 'https://example.com',
  interval: 1, // 1 second for faster testing
  category: 'test',
  tier: 3,
  tags: ['a'],
  language: 'en',
};

class TestSource extends SourceBase {
  mockItems: SourceItem[] = [];
  fetchCallCount = 0;

  async fetch(): Promise<SourceItem[]> {
    this.fetchCallCount++;
    return this.mockItems;
  }
}

function makeItem(id: string): SourceItem {
  return {
    id,
    title: `Item ${id}`,
    url: `https://example.com/${id}`,
    source: 'test',
    category: 'test',
    timestamp: new Date(),
  };
}

describe('SourceBase', () => {
  it('exposes name, category, interval', () => {
    const source = new TestSource(testConfig);
    expect(source.getName()).toBe('test-source');
    expect(source.getCategory()).toBe('test');
    expect(source.getInterval()).toBe(1);
  });

  it('fetchWithCache returns items from fetch', async () => {
    const source = new TestSource(testConfig);
    source.mockItems = [makeItem('1'), makeItem('2')];
    const items = await source.fetchWithCache();
    expect(items).toHaveLength(2);
  });

  it('returns cached items within interval', async () => {
    const source = new TestSource({ ...testConfig, interval: 3600 }); // 1 hour
    source.mockItems = [makeItem('1')];
    await source.fetchWithCache();
    source.mockItems = [makeItem('2')]; // change items
    const items = await source.fetchWithCache();
    // Should still get first result from cache
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('1');
    expect(source.fetchCallCount).toBe(1);
  });

  it('refetches after interval expires', async () => {
    const source = new TestSource({ ...testConfig, interval: 0 }); // immediate expiry
    source.mockItems = [makeItem('1')];
    await source.fetchWithCache();

    await new Promise(resolve => setTimeout(resolve, 10));

    source.mockItems = [makeItem('2')];
    const items = await source.fetchWithCache();
    expect(source.fetchCallCount).toBe(2);
  });

  it('deduplicates items by id', async () => {
    const source = new TestSource({ ...testConfig, interval: 0 });
    source.mockItems = [makeItem('dup'), makeItem('dup'), makeItem('unique')];
    const items = await source.fetchWithCache();
    expect(items).toHaveLength(2);
    const ids = items.map(i => i.id);
    expect(ids).toContain('dup');
    expect(ids).toContain('unique');
  });

  it('remembers seen IDs across multiple fetches', async () => {
    const source = new TestSource({ ...testConfig, interval: 0 });
    source.mockItems = [makeItem('seen')];
    await source.fetchWithCache();

    await new Promise(resolve => setTimeout(resolve, 5));

    source.mockItems = [makeItem('seen'), makeItem('new')];
    const items = await source.fetchWithCache();
    // 'seen' was already seen in first fetch
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('new');
  });
});
