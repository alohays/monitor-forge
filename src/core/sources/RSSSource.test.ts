import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RSSSource } from './RSSSource.js';

const testConfig = {
  name: 'test-rss',
  type: 'rss',
  url: 'https://example.com/rss.xml',
  interval: 300,
  category: 'news',
  tier: 3,
  tags: [],
  language: 'ko',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('RSSSource', () => {
  it('constructs proxy URL from config', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ items: [] }), { status: 200 }),
    );
    const source = new RSSSource(testConfig);
    await source.fetch();
    expect(fetchSpy).toHaveBeenCalledOnce();
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/news/v1');
    expect(calledUrl).toContain(encodeURIComponent(testConfig.url));
  });

  it('maps RSS items to SourceItem format', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        items: [{
          title: 'Test Article',
          link: 'https://example.com/article',
          guid: 'guid-1',
          pubDate: '2024-01-01T12:00:00Z',
          description: 'A test article',
        }],
      }), { status: 200 }),
    );
    const source = new RSSSource(testConfig);
    const items = await source.fetch();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('guid-1');
    expect(items[0].title).toBe('Test Article');
    expect(items[0].url).toBe('https://example.com/article');
    expect(items[0].source).toBe('test-rss');
    expect(items[0].category).toBe('news');
    expect(items[0].language).toBe('ko');
    expect(items[0].summary).toBe('A test article');
  });

  it('handles missing fields gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        items: [{ title: 'Minimal' }],
      }), { status: 200 }),
    );
    const source = new RSSSource(testConfig);
    const items = await source.fetch();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Minimal');
    expect(items[0].url).toBe('');
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Error', { status: 500 }),
    );
    const source = new RSSSource(testConfig);
    await expect(source.fetch()).rejects.toThrow('RSS fetch failed');
  });

  it('returns empty array when no items', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    const source = new RSSSource(testConfig);
    const items = await source.fetch();
    expect(items).toEqual([]);
  });
});
