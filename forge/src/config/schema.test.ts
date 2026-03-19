import { describe, it, expect } from 'vitest';
import {
  SourceSchema,
  LayerSchema,
  LayerDataSchema,
  PanelSchema,
  AIProviderSchema,
  AIAnalysisSchema,
  AISchema,
  MapSchema,
  CacheSchema,
  RateLimitSchema,
  CorsProxySchema,
  BackendSchema,
  BuildSchema,
  BrandingSchema,
  MonitorSchema,
  MonitorForgeConfigSchema,
  defineConfig,
} from './schema.js';

// ─── SourceSchema ──────────────────────────────────────────

describe('SourceSchema', () => {
  const validRss = {
    name: 'bbc-world',
    type: 'rss',
    url: 'https://feeds.bbc.co.uk/rss.xml',
    category: 'news',
  };

  it('accepts valid RSS source', () => {
    const result = SourceSchema.parse(validRss);
    expect(result.name).toBe('bbc-world');
    expect(result.type).toBe('rss');
  });

  it('accepts valid rest-api source', () => {
    const result = SourceSchema.parse({ ...validRss, name: 'my-api', type: 'rest-api' });
    expect(result.type).toBe('rest-api');
  });

  it('accepts valid websocket source', () => {
    const result = SourceSchema.parse({ ...validRss, name: 'ws-feed', type: 'websocket', url: 'wss://example.com/ws' });
    expect(result.type).toBe('websocket');
  });

  it('rejects name with uppercase letters', () => {
    expect(() => SourceSchema.parse({ ...validRss, name: 'MySource' })).toThrow();
  });

  it('rejects name with spaces', () => {
    expect(() => SourceSchema.parse({ ...validRss, name: 'my source' })).toThrow();
  });

  it('rejects invalid URL', () => {
    expect(() => SourceSchema.parse({ ...validRss, url: 'not-a-url' })).toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => SourceSchema.parse({ ...validRss, type: 'graphql' })).toThrow();
  });

  it('rejects empty category', () => {
    expect(() => SourceSchema.parse({ ...validRss, category: '' })).toThrow();
  });

  it('applies default tier of 3', () => {
    const result = SourceSchema.parse(validRss);
    expect(result.tier).toBe(3);
  });

  it('applies default interval of 300', () => {
    const result = SourceSchema.parse(validRss);
    expect(result.interval).toBe(300);
  });

  it('applies default language of en', () => {
    const result = SourceSchema.parse(validRss);
    expect(result.language).toBe('en');
  });

  it('applies default empty tags array', () => {
    const result = SourceSchema.parse(validRss);
    expect(result.tags).toEqual([]);
  });

  it('rejects tier below 1', () => {
    expect(() => SourceSchema.parse({ ...validRss, tier: 0 })).toThrow();
  });

  it('rejects tier above 4', () => {
    expect(() => SourceSchema.parse({ ...validRss, tier: 5 })).toThrow();
  });

  it('rejects interval below 10', () => {
    expect(() => SourceSchema.parse({ ...validRss, interval: 5 })).toThrow();
  });

  it('accepts optional headers', () => {
    const result = SourceSchema.parse({ ...validRss, headers: { 'X-Api-Key': '123' } });
    expect(result.headers).toEqual({ 'X-Api-Key': '123' });
  });

  it('accepts optional transform', () => {
    const result = SourceSchema.parse({ ...validRss, transform: 'data.items' });
    expect(result.transform).toBe('data.items');
  });
});

// ─── LayerSchema ───────────────────────────────────────────

describe('LayerDataSchema', () => {
  it('accepts static source', () => {
    const result = LayerDataSchema.parse({ source: 'static', path: 'data/geo/test.geojson' });
    expect(result.source).toBe('static');
  });

  it('accepts api source', () => {
    const result = LayerDataSchema.parse({ source: 'api', url: 'https://example.com/geo.json' });
    expect(result.source).toBe('api');
  });

  it('accepts source-ref', () => {
    const result = LayerDataSchema.parse({ source: 'source-ref', sourceRef: 'my-api' });
    expect(result.source).toBe('source-ref');
  });

  it('rejects invalid source type', () => {
    expect(() => LayerDataSchema.parse({ source: 'file' })).toThrow();
  });
});

describe('LayerSchema', () => {
  const validLayer = {
    name: 'events',
    type: 'points',
    displayName: 'Events',
    color: '#FF0000',
    data: { source: 'static', path: 'data/geo/events.geojson' },
    category: 'events',
  };

  it('accepts valid points layer', () => {
    const result = LayerSchema.parse(validLayer);
    expect(result.type).toBe('points');
  });

  it.each(['points', 'lines', 'polygons', 'heatmap', 'hexagon'] as const)('accepts %s layer type', (type) => {
    const result = LayerSchema.parse({ ...validLayer, type });
    expect(result.type).toBe(type);
  });

  it('rejects invalid hex color (missing #)', () => {
    expect(() => LayerSchema.parse({ ...validLayer, color: 'FF0000' })).toThrow();
  });

  it('rejects invalid hex color (wrong length)', () => {
    expect(() => LayerSchema.parse({ ...validLayer, color: '#FFF' })).toThrow();
  });

  it('rejects name with uppercase', () => {
    expect(() => LayerSchema.parse({ ...validLayer, name: 'MyLayer' })).toThrow();
  });

  it('applies default defaultVisible as false', () => {
    const result = LayerSchema.parse(validLayer);
    expect(result.defaultVisible).toBe(false);
  });
});

// ─── PanelSchema ───────────────────────────────────────────

describe('PanelSchema', () => {
  const validPanel = {
    name: 'main-feed',
    type: 'news-feed',
    displayName: 'News',
    position: 0,
  };

  it.each([
    'ai-brief', 'news-feed', 'market-ticker', 'entity-tracker',
    'instability-index', 'service-status', 'custom',
  ] as const)('accepts %s panel type', (type) => {
    const data = type === 'custom'
      ? { ...validPanel, type, customModule: 'MyPanel' }
      : { ...validPanel, type };
    const result = PanelSchema.parse(data);
    expect(result.type).toBe(type);
  });

  it('rejects invalid panel type', () => {
    expect(() => PanelSchema.parse({ ...validPanel, type: 'unknown' })).toThrow();
  });

  it('rejects negative position', () => {
    expect(() => PanelSchema.parse({ ...validPanel, position: -1 })).toThrow();
  });

  it('applies default empty config', () => {
    const result = PanelSchema.parse(validPanel);
    expect(result.config).toEqual({});
  });

  it('rejects name with uppercase', () => {
    expect(() => PanelSchema.parse({ ...validPanel, name: 'MyPanel' })).toThrow();
  });
});

// ─── AI Schema ─────────────────────────────────────────────

describe('AIProviderSchema', () => {
  it('accepts valid provider', () => {
    const result = AIProviderSchema.parse({ model: 'llama-3.3-70b', apiKeyEnv: 'MY_KEY' });
    expect(result.model).toBe('llama-3.3-70b');
  });

  it('rejects empty model', () => {
    expect(() => AIProviderSchema.parse({ model: '', apiKeyEnv: 'KEY' })).toThrow();
  });

  it('accepts optional baseUrl', () => {
    const result = AIProviderSchema.parse({ model: 'gpt-4', apiKeyEnv: 'KEY', baseUrl: 'https://custom.api.com' });
    expect(result.baseUrl).toBe('https://custom.api.com');
  });
});

describe('AIAnalysisSchema', () => {
  it('applies all defaults', () => {
    const result = AIAnalysisSchema.parse({});
    expect(result.summarization).toBe(true);
    expect(result.entityExtraction).toBe(true);
    expect(result.sentimentAnalysis).toBe(true);
    expect(result.focalPointDetection).toBe(false);
  });
});

describe('AISchema', () => {
  it('applies defaults', () => {
    const result = AISchema.parse({});
    expect(result.enabled).toBe(true);
    expect(result.fallbackChain).toEqual(['groq', 'openrouter']);
  });
});

// ─── Map Schema ────────────────────────────────────────────

describe('MapSchema', () => {
  it('applies all defaults', () => {
    const result = MapSchema.parse({});
    expect(result.style).toContain('cartocdn.com');
    expect(result.center).toEqual([0, 20]);
    expect(result.zoom).toBe(3);
    expect(result.projection).toBe('mercator');
    expect(result.dayNightOverlay).toBe(false);
  });

  it('accepts globe projection', () => {
    const result = MapSchema.parse({ projection: 'globe' });
    expect(result.projection).toBe('globe');
  });

  it('defaults atmosphericGlow to true', () => {
    const result = MapSchema.parse({});
    expect(result.atmosphericGlow).toBe(true);
  });

  it('defaults idleRotation to true', () => {
    const result = MapSchema.parse({});
    expect(result.idleRotation).toBe(true);
  });

  it('defaults idleRotationSpeed to 0.5', () => {
    const result = MapSchema.parse({});
    expect(result.idleRotationSpeed).toBe(0.5);
  });

  it('rejects idleRotationSpeed below 0', () => {
    expect(() => MapSchema.parse({ idleRotationSpeed: -1 })).toThrow();
  });

  it('rejects idleRotationSpeed above 5', () => {
    expect(() => MapSchema.parse({ idleRotationSpeed: 6 })).toThrow();
  });
});

// ─── Backend Schema ────────────────────────────────────────

describe('CacheSchema', () => {
  it('defaults to memory provider', () => {
    const result = CacheSchema.parse({});
    expect(result.provider).toBe('memory');
    expect(result.ttlSeconds).toBe(300);
  });

  it.each(['upstash-redis', 'vercel-kv', 'memory'] as const)('accepts %s provider', (provider) => {
    expect(CacheSchema.parse({ provider }).provider).toBe(provider);
  });
});

describe('BuildSchema', () => {
  it('defaults to vercel target', () => {
    const result = BuildSchema.parse({});
    expect(result.target).toBe('vercel');
    expect(result.outDir).toBe('dist');
  });

  it.each(['vercel', 'static', 'node'] as const)('accepts %s target', (target) => {
    expect(BuildSchema.parse({ target }).target).toBe(target);
  });
});

describe('BrandingSchema', () => {
  it('applies default primary color', () => {
    const result = BrandingSchema.parse({});
    expect(result.primaryColor).toBe('#0052CC');
  });

  it('rejects invalid hex color', () => {
    expect(() => BrandingSchema.parse({ primaryColor: 'red' })).toThrow();
  });
});

// ─── MonitorSchema ─────────────────────────────────────────

describe('MonitorSchema', () => {
  it('accepts valid monitor', () => {
    const result = MonitorSchema.parse({
      name: 'My Monitor',
      slug: 'my-monitor',
      domain: 'tech',
    });
    expect(result.name).toBe('My Monitor');
  });

  it('rejects empty name', () => {
    expect(() => MonitorSchema.parse({ name: '', slug: 'test', domain: 'test' })).toThrow();
  });

  it('rejects name over 64 chars', () => {
    expect(() => MonitorSchema.parse({ name: 'x'.repeat(65), slug: 'test', domain: 'test' })).toThrow();
  });

  it('rejects slug with uppercase', () => {
    expect(() => MonitorSchema.parse({ name: 'Test', slug: 'MySlug', domain: 'test' })).toThrow();
  });

  it('rejects description over 256 chars', () => {
    expect(() => MonitorSchema.parse({ name: 'Test', slug: 'test', domain: 'test', description: 'x'.repeat(257) })).toThrow();
  });
});

// ─── Root Config Schema ────────────────────────────────────

describe('MonitorForgeConfigSchema', () => {
  const minimalConfig = {
    monitor: { name: 'Test', slug: 'test', domain: 'general' },
  };

  it('parses minimal valid config', () => {
    const result = MonitorForgeConfigSchema.parse(minimalConfig);
    expect(result.monitor.name).toBe('Test');
    expect(result.sources).toEqual([]);
    expect(result.layers).toEqual([]);
    expect(result.panels).toEqual([]);
  });

  it('parses full config with all sections', () => {
    const full = {
      ...minimalConfig,
      sources: [{ name: 'test-rss', type: 'rss', url: 'https://example.com/rss', category: 'news' }],
      layers: [{ name: 'pts', type: 'points', displayName: 'P', color: '#FF0000', data: { source: 'static', path: 'f.geojson' }, category: 'c' }],
      panels: [{ name: 'feed', type: 'news-feed', displayName: 'Feed', position: 0 }],
      ai: { enabled: true, fallbackChain: ['groq'], providers: { groq: { model: 'm', apiKeyEnv: 'K' } } },
      map: { zoom: 5 },
      backend: { cache: { provider: 'memory' } },
      build: { target: 'static' },
    };
    const result = MonitorForgeConfigSchema.parse(full);
    expect(result.sources).toHaveLength(1);
    expect(result.layers).toHaveLength(1);
    expect(result.panels).toHaveLength(1);
    expect(result.ai.enabled).toBe(true);
    expect(result.map.zoom).toBe(5);
    expect(result.build.target).toBe('static');
  });

  it('applies all nested defaults', () => {
    const result = MonitorForgeConfigSchema.parse(minimalConfig);
    expect(result.ai.enabled).toBe(true);
    expect(result.map.projection).toBe('mercator');
    expect(result.backend.cache.provider).toBe('memory');
    expect(result.build.outDir).toBe('dist');
  });

  it('rejects missing monitor', () => {
    expect(() => MonitorForgeConfigSchema.parse({})).toThrow();
  });

  it('rejects missing monitor.name', () => {
    expect(() => MonitorForgeConfigSchema.parse({ monitor: { slug: 'test', domain: 'test' } })).toThrow();
  });
});

// ─── Security-Relevant Validation ─────────────────────────

describe('security-relevant validation', () => {
  const validRss = {
    name: 'test-src',
    type: 'rss' as const,
    url: 'https://example.com/rss',
    category: 'news',
  };

  it('rejects javascript: protocol in source URL', () => {
    expect(() => SourceSchema.parse({ ...validRss, url: 'javascript:alert(1)' })).toThrow();
  });

  it('rejects data: protocol in source URL', () => {
    expect(() => SourceSchema.parse({ ...validRss, url: 'data:text/html,<h1>test</h1>' })).toThrow();
  });

  it('allows wss:// protocol for websocket sources', () => {
    const result = SourceSchema.parse({ ...validRss, type: 'websocket', url: 'wss://example.com/ws' });
    expect(result.url).toBe('wss://example.com/ws');
  });

  it('allows ws:// protocol for websocket sources', () => {
    const result = SourceSchema.parse({ ...validRss, type: 'websocket', url: 'ws://example.com/ws' });
    expect(result.url).toBe('ws://example.com/ws');
  });

  it('rejects ftp: protocol in source URL', () => {
    expect(() => SourceSchema.parse({ ...validRss, url: 'ftp://files.example.com/data.xml' })).toThrow();
  });

  it('rejects 8-digit hex color with alpha channel', () => {
    expect(() => LayerSchema.parse({
      name: 'test', type: 'points', displayName: 'T', color: '#FF0000FF',
      data: { source: 'static', path: 'f.geojson' }, category: 'c',
    })).toThrow();
  });

  it('rejects invalid characters in hex color', () => {
    expect(() => LayerSchema.parse({
      name: 'test', type: 'points', displayName: 'T', color: '#ZZZZZZ',
      data: { source: 'static', path: 'f.geojson' }, category: 'c',
    })).toThrow();
  });

  it('allows HTML in displayName (sanitization is frontend responsibility)', () => {
    // This is intentional — Zod doesn't sanitize HTML, frontend DOMPurify does
    const result = PanelSchema.parse({
      name: 'test-panel', type: 'news-feed',
      displayName: '<img onerror=alert(1)>',
      position: 0,
    });
    expect(result.displayName).toContain('<img');
  });
});

// ─── Boundary Value Tests ─────────────────────────────────

describe('boundary values', () => {
  const validRss = {
    name: 'test-src',
    type: 'rss' as const,
    url: 'https://example.com/rss',
    category: 'news',
  };

  it('accepts tier exactly 1 (lower boundary)', () => {
    const result = SourceSchema.parse({ ...validRss, tier: 1 });
    expect(result.tier).toBe(1);
  });

  it('accepts tier exactly 4 (upper boundary)', () => {
    const result = SourceSchema.parse({ ...validRss, tier: 4 });
    expect(result.tier).toBe(4);
  });

  it('accepts interval exactly 10 (minimum)', () => {
    const result = SourceSchema.parse({ ...validRss, interval: 10 });
    expect(result.interval).toBe(10);
  });

  it('rejects interval of 9 (below minimum)', () => {
    expect(() => SourceSchema.parse({ ...validRss, interval: 9 })).toThrow();
  });

  it('accepts position 0 (minimum)', () => {
    const result = PanelSchema.parse({ name: 'p', type: 'news-feed', displayName: 'P', position: 0 });
    expect(result.position).toBe(0);
  });

  it('accepts a large position value', () => {
    const result = PanelSchema.parse({ name: 'p', type: 'news-feed', displayName: 'P', position: 999 });
    expect(result.position).toBe(999);
  });

  it('rejects empty slug', () => {
    expect(() => MonitorSchema.parse({ name: 'Test', slug: '', domain: 'test' })).toThrow();
  });

  it('accepts name exactly 64 chars (max boundary)', () => {
    const result = MonitorSchema.parse({ name: 'x'.repeat(64), slug: 'test', domain: 'test' });
    expect(result.name).toBe('x'.repeat(64));
  });

  it('rejects name at 65 chars (above max)', () => {
    expect(() => MonitorSchema.parse({ name: 'x'.repeat(65), slug: 'test', domain: 'test' })).toThrow();
  });

  it('accepts description exactly 256 chars (max boundary)', () => {
    const result = MonitorSchema.parse({ name: 'T', slug: 'test', domain: 'test', description: 'x'.repeat(256) });
    expect(result.description).toBe('x'.repeat(256));
  });

  it('rejects description at 257 chars (above max)', () => {
    expect(() => MonitorSchema.parse({ name: 'T', slug: 'test', domain: 'test', description: 'x'.repeat(257) })).toThrow();
  });

  it('accepts float numbers for tier by rejecting (must be int)', () => {
    expect(() => SourceSchema.parse({ ...validRss, tier: 2.5 })).toThrow();
  });

  it('LayerData accepts source-ref without runtime existence check', () => {
    // Schema-level validation does not check if sourceRef actually exists
    const result = LayerDataSchema.parse({ source: 'source-ref', sourceRef: 'nonexistent-source' });
    expect(result.sourceRef).toBe('nonexistent-source');
  });
});

describe('defineConfig', () => {
  it('validates and returns config', () => {
    const config = defineConfig({
      version: '1',
      monitor: { name: 'Test', slug: 'test', description: '', domain: 'test', tags: [], branding: { primaryColor: '#000000' } },
      sources: [], layers: [], panels: [], views: [],
      ai: { enabled: false, fallbackChain: [], providers: {}, analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false } },
      map: { style: 'https://example.com/style.json', center: [0, 0], zoom: 3, minZoom: 1, maxZoom: 20, projection: 'mercator', dayNightOverlay: false, atmosphericGlow: true, idleRotation: true, idleRotationSpeed: 0.5 },
      backend: { cache: { provider: 'memory', ttlSeconds: 300 }, rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 }, corsProxy: { enabled: true, allowedDomains: ['*'], corsOrigins: ['*'] } },
      build: { target: 'vercel', outDir: 'dist' },
      theme: { mode: 'dark' as const, palette: 'default' as const, colors: {}, panelPosition: 'right' as const, panelWidth: 380, compactMode: false },
    });
    expect(config.monitor.name).toBe('Test');
  });

  it('throws on invalid config', () => {
    expect(() => defineConfig({} as any)).toThrow();
  });
});
