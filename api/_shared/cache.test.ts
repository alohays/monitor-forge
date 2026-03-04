import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCached, invalidateCache } from './cache.js';

describe('getCached', () => {
  beforeEach(() => {
    // Invalidate all by calling with unique keys each test
    invalidateCache('test-key');
    invalidateCache('test-key-2');
  });

  it('calls fetcher on first access', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const key = `test-${Date.now()}-${Math.random()}`;
    const result = await getCached(key, 60, fetcher);
    expect(result).toBe('data');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('returns cached data on second access within TTL', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const key = `test-${Date.now()}-${Math.random()}`;
    await getCached(key, 60, fetcher);
    const result = await getCached(key, 60, fetcher);
    expect(result).toBe('data');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('calls fetcher again after TTL expires', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce('old')
      .mockResolvedValueOnce('new');
    const key = `test-${Date.now()}-${Math.random()}`;

    // TTL of 0 seconds means it expires immediately
    await getCached(key, 0, fetcher);

    // Wait a tiny bit to ensure expiry
    await new Promise(resolve => setTimeout(resolve, 5));

    const result = await getCached(key, 0, fetcher);
    expect(result).toBe('new');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('properly isolates different cache keys', async () => {
    const keyA = `key-a-${Date.now()}`;
    const keyB = `key-b-${Date.now()}`;
    await getCached(keyA, 60, async () => 'dataA');
    await getCached(keyB, 60, async () => 'dataB');
    const resultA = await getCached(keyA, 60, async () => 'stale');
    const resultB = await getCached(keyB, 60, async () => 'stale');
    expect(resultA).toBe('dataA');
    expect(resultB).toBe('dataB');
  });
});

describe('invalidateCache', () => {
  it('removes entry so next getCached calls fetcher', async () => {
    const key = `test-invalidate-${Date.now()}`;
    const fetcher = vi.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    await getCached(key, 60, fetcher);
    invalidateCache(key);
    const result = await getCached(key, 60, fetcher);
    expect(result).toBe('second');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
