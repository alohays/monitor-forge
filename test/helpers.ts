import type { MonitorForgeConfig } from '../forge/src/config/schema.js';

/**
 * Build a minimal valid MonitorForgeConfig for testing.
 */
export function buildConfig(overrides?: Partial<MonitorForgeConfig>): MonitorForgeConfig {
  return {
    monitor: {
      name: 'Test Monitor',
      slug: 'test-monitor',
      description: '',
      domain: 'test',
      tags: [],
      branding: { primaryColor: '#0052CC' },
    },
    sources: [],
    layers: [],
    panels: [],
    ai: {
      enabled: false,
      fallbackChain: [],
      providers: {},
      analysis: {
        summarization: true,
        entityExtraction: true,
        sentimentAnalysis: true,
        focalPointDetection: false,
      },
    },
    map: {
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [0, 20],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      projection: 'mercator',
      dayNightOverlay: false,
    },
    backend: {
      cache: { provider: 'memory', ttlSeconds: 300 },
      rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 },
      corsProxy: { enabled: true, allowedDomains: ['*'] },
    },
    build: { target: 'vercel', outDir: 'dist' },
    ...overrides,
  };
}

/**
 * Build a valid RSS source config for testing.
 */
export function buildRssSource(overrides?: Record<string, unknown>) {
  return {
    name: 'test-feed',
    type: 'rss' as const,
    url: 'https://example.com/rss.xml',
    category: 'news',
    tier: 3,
    interval: 300,
    language: 'en',
    tags: [],
    ...overrides,
  };
}

/**
 * Build a valid layer config for testing.
 */
export function buildLayer(overrides?: Record<string, unknown>) {
  return {
    name: 'test-layer',
    type: 'points' as const,
    displayName: 'Test Layer',
    color: '#FF0000',
    data: { source: 'static' as const, path: 'data/geo/test.geojson' },
    defaultVisible: false,
    category: 'test',
    ...overrides,
  };
}

/**
 * Build a valid panel config for testing.
 */
export function buildPanel(overrides?: Record<string, unknown>) {
  return {
    name: 'test-panel',
    type: 'news-feed' as const,
    displayName: 'Test Panel',
    position: 0,
    config: {},
    ...overrides,
  };
}

/**
 * Create a fake Request for API endpoint testing.
 */
export function createRequest(
  url: string,
  init?: RequestInit,
): Request {
  return new Request(url, init);
}
