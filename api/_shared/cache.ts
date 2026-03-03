const memoryCache = new Map<string, { data: unknown; expires: number }>();

export async function getCached<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = memoryCache.get(key);
  if (cached && Date.now() < cached.expires) {
    return cached.data as T;
  }

  const data = await fetcher();
  memoryCache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
  return data;
}

export function invalidateCache(key: string): void {
  memoryCache.delete(key);
}
