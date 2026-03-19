import { describe, it, expect } from 'vitest';
import { createDefaultConfig } from './defaults.js';
import { MonitorForgeConfigSchema } from './schema.js';

describe('createDefaultConfig', () => {
  it('returns valid config with no overrides', () => {
    const config = createDefaultConfig();
    expect(config.monitor.name).toBe('My Monitor');
    expect(config.monitor.slug).toBe('my-monitor');
    expect(config.monitor.domain).toBe('general');
  });

  it('applies monitor name override', () => {
    const config = createDefaultConfig({ monitor: { name: 'Custom', slug: 'custom', description: '', domain: 'tech', tags: [], branding: { primaryColor: '#FF0000' } } });
    expect(config.monitor.name).toBe('Custom');
  });

  it('applies sources override', () => {
    const config = createDefaultConfig({
      sources: [{ name: 'test', type: 'rss', url: 'https://example.com/rss', category: 'news', tier: 3, interval: 300, language: 'en', tags: [], authHeader: 'Authorization', cacheTtl: 300 }],
    });
    expect(config.sources).toHaveLength(1);
  });

  it('preserves default AI config when not overridden', () => {
    const config = createDefaultConfig();
    expect(config.ai.enabled).toBe(true);
    expect(config.ai.fallbackChain).toEqual(['groq', 'openrouter']);
    expect(config.ai.providers.groq).toBeDefined();
    expect(config.ai.providers.openrouter).toBeDefined();
  });

  it('preserves default map config when not overridden', () => {
    const config = createDefaultConfig();
    expect(config.map.center).toEqual([0, 20]);
    expect(config.map.zoom).toBe(3);
    expect(config.map.projection).toBe('mercator');
    expect(config.map.atmosphericGlow).toBe(true);
    expect(config.map.idleRotation).toBe(true);
    expect(config.map.idleRotationSpeed).toBe(0.5);
  });

  it('preserves default backend config when not overridden', () => {
    const config = createDefaultConfig();
    expect(config.backend.cache.provider).toBe('memory');
    expect(config.backend.rateLimit.enabled).toBe(true);
  });

  it('output passes MonitorForgeConfigSchema validation', () => {
    const config = createDefaultConfig();
    expect(() => MonitorForgeConfigSchema.parse(config)).not.toThrow();
  });

  it('output with overrides passes schema validation', () => {
    const config = createDefaultConfig({
      monitor: { name: 'Overridden', slug: 'overridden', description: '', domain: 'finance', tags: [], branding: { primaryColor: '#00FF00' } },
      sources: [{ name: 'feed', type: 'rss', url: 'https://example.com/rss', category: 'finance', tier: 1, interval: 60, language: 'ko', tags: ['crypto'], authHeader: 'Authorization', cacheTtl: 300 }],
    });
    expect(() => MonitorForgeConfigSchema.parse(config)).not.toThrow();
  });
});
