import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APISource } from './APISource.js';

const testConfig = {
  name: 'test-api',
  type: 'rest-api',
  url: 'https://api.example.com/data',
  interval: 300,
  category: 'data',
  tier: 3,
  tags: [],
  language: 'en',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('APISource', () => {
  it('fetches from config URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: '1', title: 'Item 1' }]), { status: 200 }),
    );
    const source = new APISource(testConfig);
    await source.fetch();
    expect(fetchSpy.mock.calls[0][0]).toBe(testConfig.url);
  });

  it('maps array response to SourceItem format', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([
        { id: 'item-1', title: 'First', url: 'https://example.com/1', date: '2024-01-01' },
      ]), { status: 200 }),
    );
    const source = new APISource(testConfig);
    const items = await source.fetch();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('item-1');
    expect(items[0].title).toBe('First');
    expect(items[0].source).toBe('test-api');
  });

  it('applies transform path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        data: { results: [{ id: 'deep', title: 'Deep Item' }] },
      }), { status: 200 }),
    );
    const source = new APISource({ ...testConfig, transform: 'data.results' });
    const items = await source.fetch();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('deep');
  });

  it('wraps single object in array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'single', title: 'Solo' }), { status: 200 }),
    );
    const source = new APISource(testConfig);
    const items = await source.fetch();
    expect(items).toHaveLength(1);
  });

  it('throws on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not found', { status: 404 }),
    );
    const source = new APISource(testConfig);
    await expect(source.fetch()).rejects.toThrow('API fetch failed');
  });
});
