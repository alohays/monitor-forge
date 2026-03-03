import type { MonitorForgeConfig } from './schema.js';

export function createDefaultConfig(overrides?: Partial<MonitorForgeConfig>): MonitorForgeConfig {
  return {
    monitor: {
      name: overrides?.monitor?.name ?? 'My Monitor',
      slug: overrides?.monitor?.slug ?? 'my-monitor',
      description: overrides?.monitor?.description ?? 'A custom real-time intelligence dashboard',
      domain: overrides?.monitor?.domain ?? 'general',
      tags: overrides?.monitor?.tags ?? [],
      branding: {
        primaryColor: overrides?.monitor?.branding?.primaryColor ?? '#0052CC',
        ...overrides?.monitor?.branding,
      },
    },
    sources: overrides?.sources ?? [],
    layers: overrides?.layers ?? [],
    panels: overrides?.panels ?? [],
    ai: {
      enabled: true,
      fallbackChain: ['groq', 'openrouter'],
      providers: {
        groq: {
          model: 'llama-3.3-70b-versatile',
          apiKeyEnv: 'GROQ_API_KEY',
        },
        openrouter: {
          model: 'meta-llama/llama-3.3-70b-instruct',
          apiKeyEnv: 'OPENROUTER_API_KEY',
        },
      },
      analysis: {
        summarization: true,
        entityExtraction: true,
        sentimentAnalysis: true,
        focalPointDetection: false,
      },
      ...overrides?.ai,
    },
    map: {
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [0, 20],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18,
      projection: 'mercator',
      dayNightOverlay: false,
      ...overrides?.map,
    },
    backend: {
      cache: { provider: 'memory', ttlSeconds: 300 },
      rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 },
      corsProxy: { enabled: true, allowedDomains: ['*'] },
      ...overrides?.backend,
    },
    build: {
      target: 'vercel',
      outDir: 'dist',
      ...overrides?.build,
    },
  };
}
