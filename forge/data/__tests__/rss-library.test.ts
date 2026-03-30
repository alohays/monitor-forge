import { describe, it, expect } from 'vitest';
import { RssLibrarySchema } from '../rss-library.schema.js';
import library from '../rss-library.json';

describe('RSS Library', () => {
  it('validates against schema', () => {
    const result = RssLibrarySchema.safeParse(library);
    expect(result.success).toBe(true);
  });

  it('contains at least 200 entries', () => {
    expect(library.entries.length).toBeGreaterThanOrEqual(200);
  });

  it('has all 20 categories with at least 5 entries each', () => {
    const expected = [
      'politics', 'us', 'europe', 'middleeast', 'africa', 'latam', 'asia',
      'tech', 'ai', 'startups', 'security', 'finance', 'crypto', 'commodities',
      'defense', 'thinktanks', 'crisis', 'energy', 'climate', 'happy',
    ];
    for (const cat of expected) {
      const count = library.entries.filter((e: { category: string }) => e.category === cat).length;
      expect(count, `Category "${cat}" has ${count} entries`).toBeGreaterThanOrEqual(5);
    }
  });

  it('has no duplicate IDs', () => {
    const ids = library.entries.map((e: { id: string }) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate URLs', () => {
    const urls = library.entries.map((e: { url: string }) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('has propagandaRisk on all entries', () => {
    for (const entry of library.entries) {
      expect(entry.propagandaRisk).toBeDefined();
      expect(['none', 'low', 'medium', 'high']).toContain(entry.propagandaRisk);
    }
  });

  it('has verified field on all entries', () => {
    for (const entry of library.entries) {
      expect(typeof entry.verified).toBe('boolean');
    }
  });

  it('has Google News fallback for thin categories', () => {
    const thinCategories = ['africa', 'latam', 'crisis', 'happy'];
    for (const cat of thinCategories) {
      const entries = library.entries.filter((e: { category: string }) => e.category === cat);
      const hasFallback = entries.some(
        (e: { fallbackUrl?: string }) => e.fallbackUrl?.includes('news.google.com'),
      );
      expect(hasFallback, `Category "${cat}" should have at least one Google News fallback`).toBe(true);
    }
  });
});
