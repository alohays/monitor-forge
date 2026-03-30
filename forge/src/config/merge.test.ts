import { describe, it, expect } from 'vitest';
import { mergeConfig } from './merge.js';
import { MonitorForgeConfigSchema, SourceSchema, PanelSchema, ViewSchema, type MonitorForgeConfig } from './schema.js';

/** Minimal valid base config for testing. */
function makeBaseConfig(overrides?: Partial<MonitorForgeConfig>): MonitorForgeConfig {
  return MonitorForgeConfigSchema.parse({
    monitor: { name: 'Test', slug: 'test', domain: 'general' },
    sources: [],
    layers: [],
    panels: [],
    views: [],
    ...overrides,
  });
}

/** Helper source fixture. */
function makeSource(name: string, overrides?: Record<string, unknown>) {
  return {
    name,
    type: 'rss',
    url: `https://${name}.example.com/rss`,
    category: 'news',
    ...overrides,
  };
}

/** Helper panel fixture. */
function makePanel(name: string, position = 0) {
  return {
    name,
    type: 'news-feed',
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    position,
  };
}

/** Helper view fixture. */
function makeView(name: string, panels: string[]) {
  return {
    name,
    displayName: name.charAt(0).toUpperCase() + name.slice(1),
    panels,
  };
}

describe('mergeConfig', () => {
  // 1. Add new source via patch
  it('adds a new source via patch', () => {
    const base = makeBaseConfig();
    const patch = { sources: [makeSource('new-feed')] };

    const result = mergeConfig(base, patch);

    expect(result.config.sources).toHaveLength(1);
    expect(result.config.sources[0].name).toBe('new-feed');
    expect(result.changes).toContainEqual({ type: 'added', path: 'sources', name: 'new-feed' });
  });

  // 2. Update existing source (merge-by-name)
  it('updates existing source by name', () => {
    const base = makeBaseConfig({
      sources: [SourceSchema.parse(makeSource('my-feed', { category: 'news' }))],
    });
    const patch = { sources: [{ name: 'my-feed', category: 'tech' }] };

    const result = mergeConfig(base, patch);

    expect(result.config.sources).toHaveLength(1);
    expect(result.config.sources[0].category).toBe('tech');
    expect(result.config.sources[0].url).toBe('https://my-feed.example.com/rss');
    expect(result.changes).toContainEqual({ type: 'updated', path: 'sources', name: 'my-feed' });
  });

  // 3. Delete source with _delete marker
  it('removes source with _delete marker', () => {
    const base = makeBaseConfig({
      sources: [SourceSchema.parse(makeSource('to-remove'))],
    });
    const patch = { sources: [{ name: 'to-remove', _delete: true }] };

    const result = mergeConfig(base, patch);

    expect(result.config.sources).toHaveLength(0);
    expect(result.changes).toContainEqual({ type: 'removed', path: 'sources', name: 'to-remove' });
  });

  // 4. Deep merge AI config (nested objects)
  it('deep merges AI config', () => {
    const base = makeBaseConfig();
    const patch = {
      ai: {
        enabled: false,
        analysis: { focalPointDetection: true },
      },
    };

    const result = mergeConfig(base, patch);

    expect(result.config.ai.enabled).toBe(false);
    expect(result.config.ai.analysis.focalPointDetection).toBe(true);
    // Existing nested values are preserved
    expect(result.config.ai.analysis.summarization).toBe(true);
  });

  // 5. Deep merge theme config
  it('deep merges theme config', () => {
    const base = makeBaseConfig();
    const patch = {
      theme: {
        palette: 'ocean',
        compactMode: true,
      },
    };

    const result = mergeConfig(base, patch);

    expect(result.config.theme.palette).toBe('ocean');
    expect(result.config.theme.compactMode).toBe(true);
    // Preserved
    expect(result.config.theme.panelPosition).toBe('right');
    expect(result.config.theme.panelWidth).toBe(380);
  });

  // 6. Apply with empty base config sources array
  it('adds sources when base has empty sources array', () => {
    const base = makeBaseConfig({ sources: [] });
    const patch = { sources: [makeSource('first-feed')] };

    const result = mergeConfig(base, patch);

    expect(result.config.sources).toHaveLength(1);
    expect(result.config.sources[0].name).toBe('first-feed');
  });

  // 7. Apply invalid patch that would fail validation (expect error)
  it('produces config that fails Zod validation when patch is invalid', () => {
    const base = makeBaseConfig();
    // Overwrite monitor with an invalid object (missing required fields)
    const patch = { monitor: { name: '', slug: '' } };

    const result = mergeConfig(base, patch);

    // mergeConfig itself does not validate — the caller validates
    expect(() => MonitorForgeConfigSchema.parse(result.config)).toThrow();
  });

  // 8. Dry-run compatibility (merge returns result without writing)
  it('returns merged config without side effects', () => {
    const base = makeBaseConfig();
    const patch = { sources: [makeSource('dry-run-feed')] };

    const result = mergeConfig(base, patch);

    // Result is a new object, base is not mutated
    expect(base.sources).toHaveLength(0);
    expect(result.config.sources).toHaveLength(1);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  // 9. Multiple operations in single patch (add + update + delete)
  it('handles add, update, and delete in a single patch', () => {
    const base = makeBaseConfig({
      sources: [
        SourceSchema.parse(makeSource('keep-feed')),
        SourceSchema.parse(makeSource('update-feed')),
        SourceSchema.parse(makeSource('remove-feed')),
      ],
    });
    const patch = {
      sources: [
        makeSource('new-feed'),
        { name: 'update-feed', category: 'updated-category' },
        { name: 'remove-feed', _delete: true },
      ],
    };

    const result = mergeConfig(base, patch);

    expect(result.config.sources).toHaveLength(3); // keep + updated + new
    expect(result.config.sources.find((s: any) => s.name === 'keep-feed')).toBeDefined();
    expect(result.config.sources.find((s: any) => s.name === 'new-feed')).toBeDefined();
    expect(result.config.sources.find((s: any) => s.name === 'update-feed')?.category).toBe('updated-category');
    expect(result.config.sources.find((s: any) => s.name === 'remove-feed')).toBeUndefined();

    const types = result.changes.map(c => c.type);
    expect(types).toContain('added');
    expect(types).toContain('updated');
    expect(types).toContain('removed');
  });

  // 10. Idempotent re-apply (apply same patch twice, result unchanged)
  it('is idempotent when applying the same patch twice', () => {
    const base = makeBaseConfig();
    const patch = {
      sources: [makeSource('idem-feed')],
      theme: { palette: 'midnight' },
    };

    const first = mergeConfig(base, patch);
    const validated = MonitorForgeConfigSchema.parse(first.config);
    const second = mergeConfig(validated, patch);
    const validatedSecond = MonitorForgeConfigSchema.parse(second.config);

    expect(validatedSecond.sources).toHaveLength(1);
    expect(validatedSecond.sources[0].name).toBe('idem-feed');
    expect(validatedSecond.theme.palette).toBe('midnight');
    // JSON representations should match
    expect(JSON.stringify(validated)).toEqual(JSON.stringify(validatedSecond));
  });

  // 11. Add source with same name as existing (updates, no duplicate)
  it('updates source when adding with same name (no duplicate)', () => {
    const base = makeBaseConfig({
      sources: [SourceSchema.parse(makeSource('dup-feed', { category: 'old' }))],
    });
    const patch = { sources: [makeSource('dup-feed', { category: 'new' })] };

    const result = mergeConfig(base, patch);

    expect(result.config.sources).toHaveLength(1);
    expect(result.config.sources[0].category).toBe('new');
    expect(result.changes).toContainEqual({ type: 'updated', path: 'sources', name: 'dup-feed' });
  });

  // 12. Delete non-existent item (no error, just no-op)
  it('handles delete of non-existent item as no-op', () => {
    const base = makeBaseConfig();
    const patch = { sources: [{ name: 'ghost', _delete: true }] };

    const result = mergeConfig(base, patch);

    expect(result.config.sources).toHaveLength(0);
    // No 'removed' change since it did not exist
    expect(result.changes.filter(c => c.type === 'removed')).toHaveLength(0);
  });

  // 13. Patch that would produce config failing Zod validation
  it('returns invalid config when patch corrupts required fields', () => {
    const base = makeBaseConfig();
    // Setting version to a number instead of string
    const patch = { version: 123 as unknown as string };

    const result = mergeConfig(base, patch);

    expect(() => MonitorForgeConfigSchema.parse(result.config)).toThrow();
  });

  // 14. Empty patch (no changes)
  it('returns unchanged config for empty patch', () => {
    const base = makeBaseConfig();
    const patch = {};

    const result = mergeConfig(base, patch);

    expect(result.changes).toHaveLength(0);
    expect(JSON.stringify(result.config)).toEqual(JSON.stringify(base));
  });

  // 15. Merge panels array by name
  it('merges panels array by name', () => {
    const base = makeBaseConfig({
      panels: [PanelSchema.parse(makePanel('news', 0))],
    });
    const patch = {
      panels: [
        { name: 'news', displayName: 'Updated News' },
        makePanel('market', 1),
      ],
    };

    const result = mergeConfig(base, patch);

    expect(result.config.panels).toHaveLength(2);
    expect(result.config.panels.find((p: any) => p.name === 'news')?.displayName).toBe('Updated News');
    expect(result.config.panels.find((p: any) => p.name === 'market')).toBeDefined();
    expect(result.changes).toContainEqual({ type: 'updated', path: 'panels', name: 'news' });
    expect(result.changes).toContainEqual({ type: 'added', path: 'panels', name: 'market' });
  });

  // 16. Merge views array by name
  it('merges views array by name', () => {
    const base = makeBaseConfig({
      views: [ViewSchema.parse(makeView('main', ['news']))],
    });
    const patch = {
      views: [
        { name: 'main', displayName: 'Dashboard' },
        makeView('secondary', ['market']),
      ],
    };

    const result = mergeConfig(base, patch);

    expect(result.config.views).toHaveLength(2);
    expect(result.config.views.find((v: any) => v.name === 'main')?.displayName).toBe('Dashboard');
    expect(result.config.views.find((v: any) => v.name === 'secondary')).toBeDefined();
    expect(result.changes).toContainEqual({ type: 'updated', path: 'views', name: 'main' });
    expect(result.changes).toContainEqual({ type: 'added', path: 'views', name: 'secondary' });
  });

  // Additional: deep merge backend config
  it('deep merges backend config preserving unmentioned nested fields', () => {
    const base = makeBaseConfig();
    const patch = {
      backend: {
        cache: { provider: 'upstash-redis' },
      },
    };

    const result = mergeConfig(base, patch);

    expect(result.config.backend.cache.provider).toBe('upstash-redis');
    // Preserved
    expect(result.config.backend.cache.ttlSeconds).toBe(300);
    expect(result.config.backend.rateLimit.enabled).toBe(true);
  });
});
