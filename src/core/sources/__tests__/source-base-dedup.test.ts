import { describe, it, expect } from 'vitest';
import { SourceBase, type SourceItem, type SourceConfig } from '../SourceBase.js';

const testConfig: SourceConfig = {
  name: 'dedup-test',
  type: 'test',
  url: 'https://example.com',
  interval: 0, // immediate cache expiry for testing
  category: 'test',
  tier: 3,
  tags: [],
  language: 'en',
  authHeader: 'Authorization',
  cacheTtl: 0,
};

class TestSource extends SourceBase {
  mockItems: SourceItem[] = [];

  async fetch(): Promise<SourceItem[]> {
    return this.mockItems;
  }

  /** Expose seenIds size for testing */
  getSeenIdsSize(): number {
    // Access the private seenIds via fetchWithCache side-effect tracking
    return (this as unknown as { seenIds: Set<string> }).seenIds.size;
  }
}

function makeItem(id: string): SourceItem {
  return {
    id,
    title: `Item ${id}`,
    url: `https://example.com/${id}`,
    source: 'dedup-test',
    category: 'test',
    timestamp: new Date(),
  };
}

describe('SourceBase seenIds cap', () => {
  it('caps seenIds at 10,000 entries', async () => {
    const source = new TestSource(testConfig);

    // Feed 10,000 unique items in batches
    for (let batch = 0; batch < 100; batch++) {
      const items: SourceItem[] = [];
      for (let i = 0; i < 100; i++) {
        items.push(makeItem(`batch${batch}-item${i}`));
      }
      source.mockItems = items;
      await source.fetchWithCache();
      // Small delay so cache expires (interval=0)
      await new Promise((r) => setTimeout(r, 1));
    }

    // Now seenIds should be at 10,000
    expect(source.getSeenIdsSize()).toBe(10_000);

    // Feed another batch of 100 items — should trigger eviction of 2,000 oldest
    const newItems: SourceItem[] = [];
    for (let i = 0; i < 100; i++) {
      newItems.push(makeItem(`overflow-${i}`));
    }
    source.mockItems = newItems;
    await new Promise((r) => setTimeout(r, 1));
    const result = await source.fetchWithCache();

    // All 100 new items should pass dedup (they're new)
    expect(result).toHaveLength(100);

    // seenIds should be 10,000 - 2,000 (evicted) + 100 (new) = 8,100
    expect(source.getSeenIdsSize()).toBe(8_100);
  });

  it('evicts oldest entries first and still tracks new ones', async () => {
    const source = new TestSource(testConfig);

    // Fill with items id-0 through id-9999
    for (let batch = 0; batch < 100; batch++) {
      const items: SourceItem[] = [];
      for (let i = 0; i < 100; i++) {
        const idx = batch * 100 + i;
        items.push(makeItem(`id-${idx}`));
      }
      source.mockItems = items;
      await source.fetchWithCache();
      await new Promise((r) => setTimeout(r, 1));
    }

    expect(source.getSeenIdsSize()).toBe(10_000);

    // Trigger eviction by adding one more batch
    source.mockItems = [makeItem('new-item')];
    await new Promise((r) => setTimeout(r, 1));
    const result = await source.fetchWithCache();

    // The new item should be returned (it's genuinely new)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new-item');

    // The oldest 2,000 entries (id-0 through id-1999) should have been evicted
    // Verify by trying to add one that was evicted — it should pass dedup
    source.mockItems = [makeItem('id-0')];
    await new Promise((r) => setTimeout(r, 1));
    const evictedResult = await source.fetchWithCache();
    expect(evictedResult).toHaveLength(1); // id-0 was evicted, so it's "new" again
    expect(evictedResult[0].id).toBe('id-0');
  });

  it('does not evict when below capacity', async () => {
    const source = new TestSource(testConfig);

    // Add only 100 items — well below 10,000 cap
    const items: SourceItem[] = [];
    for (let i = 0; i < 100; i++) {
      items.push(makeItem(`small-${i}`));
    }
    source.mockItems = items;
    await source.fetchWithCache();

    expect(source.getSeenIdsSize()).toBe(100);

    // Add same items again — all should be deduped
    await new Promise((r) => setTimeout(r, 1));
    const result = await source.fetchWithCache();
    expect(result).toHaveLength(0); // all seen before
    expect(source.getSeenIdsSize()).toBe(100); // no change
  });
});
