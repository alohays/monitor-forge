import { describe, it, expect } from 'vitest';
import { generateVercelConfig } from './vercel-generator.js';
import type { MonitorForgeConfig } from '../config/schema.js';

function buildConfig(overrides?: Partial<MonitorForgeConfig>): MonitorForgeConfig {
  return {
    monitor: { name: 'Test', slug: 'test', description: '', domain: 'test', tags: [], branding: { primaryColor: '#0052CC' } },
    sources: [], layers: [], panels: [],
    ai: { enabled: false, fallbackChain: [], providers: {}, analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false } },
    map: { style: 'https://example.com/style.json', center: [0, 0], zoom: 3, minZoom: 2, maxZoom: 18, projection: 'mercator', dayNightOverlay: false, atmosphericGlow: true, idleRotation: true, idleRotationSpeed: 0.5 },
    backend: { cache: { provider: 'memory', ttlSeconds: 300 }, rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 }, corsProxy: { enabled: true, allowedDomains: ['*'], corsOrigins: ['*'] } },
    build: { target: 'vercel', outDir: 'dist' },
    ...overrides,
  };
}

describe('generateVercelConfig', () => {
  it('sets outputDirectory from config.build.outDir', () => {
    const config = buildConfig({ build: { target: 'vercel', outDir: 'custom-out' } });
    const result = generateVercelConfig(config);
    expect(result.outputDirectory).toBe('custom-out');
  });

  it('includes security headers', () => {
    const result = generateVercelConfig(buildConfig());
    const headers = result.headers as Array<{ source: string; headers: Array<{ key: string }> }>;
    const globalHeaders = headers.find(h => h.source === '/(.*)')!;
    const headerKeys = globalHeaders.headers.map(h => h.key);
    expect(headerKeys).toContain('X-Frame-Options');
    expect(headerKeys).toContain('X-Content-Type-Options');
    expect(headerKeys).toContain('Strict-Transport-Security');
    expect(headerKeys).toContain('Permissions-Policy');
  });

  it('includes cache headers for assets', () => {
    const result = generateVercelConfig(buildConfig());
    const headers = result.headers as Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
    const assetHeaders = headers.find(h => h.source === '/assets/(.*)')!;
    const cacheHeader = assetHeaders.headers.find(h => h.key === 'Cache-Control')!;
    expect(cacheHeader.value).toContain('max-age=31536000');
    expect(cacheHeader.value).toContain('immutable');
  });

  it('includes API rewrite rule', () => {
    const result = generateVercelConfig(buildConfig());
    const rewrites = result.rewrites as Array<{ source: string; destination: string }>;
    expect(rewrites).toContainEqual({ source: '/api/:path*', destination: '/api/:path*' });
  });
});
