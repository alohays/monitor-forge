import { describe, it, expect } from 'vitest';
import { generateEnvExample } from './env-generator.js';
import type { MonitorForgeConfig } from '../config/schema.js';

function buildConfig(overrides?: Partial<MonitorForgeConfig>): MonitorForgeConfig {
  return {
    monitor: { name: 'Test', slug: 'test', description: '', domain: 'test', tags: [], branding: { primaryColor: '#0052CC' } },
    sources: [], layers: [], panels: [],
    ai: { enabled: false, fallbackChain: [], providers: {}, analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false } },
    map: { style: 'https://example.com/style.json', center: [0, 0], zoom: 3, minZoom: 2, maxZoom: 18, projection: 'mercator', dayNightOverlay: false },
    backend: { cache: { provider: 'memory', ttlSeconds: 300 }, rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 }, corsProxy: { enabled: true, allowedDomains: ['*'] } },
    build: { target: 'vercel', outDir: 'dist' },
    ...overrides,
  };
}

describe('generateEnvExample', () => {
  it('marks fallback chain provider as required when AI enabled', () => {
    const config = buildConfig({
      ai: {
        enabled: true,
        fallbackChain: ['groq'],
        providers: { groq: { model: 'llama', apiKeyEnv: 'GROQ_API_KEY' } },
        analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false },
      },
    });
    const result = generateEnvExample(config);
    expect(result).toContain('GROQ_API_KEY=');
    expect(result).toContain('(required)');
  });

  it('marks non-fallback-chain providers as optional', () => {
    const config = buildConfig({
      ai: {
        enabled: true,
        fallbackChain: ['groq'],
        providers: {
          groq: { model: 'llama', apiKeyEnv: 'GROQ_API_KEY' },
          openrouter: { model: 'llama', apiKeyEnv: 'OPENROUTER_API_KEY' },
        },
        analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false },
      },
    });
    const result = generateEnvExample(config);
    // groq IS in fallback chain → required
    expect(result).toContain('groq API key (required)');
    // openrouter is NOT in fallback chain → optional
    expect(result).toContain('openrouter API key (optional)');
  });

  it('includes Upstash vars when upstash-redis cache configured', () => {
    const config = buildConfig({
      backend: {
        cache: { provider: 'upstash-redis', ttlSeconds: 300 },
        rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 },
        corsProxy: { enabled: true, allowedDomains: ['*'] },
      },
    });
    const result = generateEnvExample(config);
    expect(result).toContain('UPSTASH_REDIS_REST_URL=');
    expect(result).toContain('UPSTASH_REDIS_REST_TOKEN=');
  });

  it('includes Vercel KV vars when vercel-kv cache configured', () => {
    const config = buildConfig({
      backend: {
        cache: { provider: 'vercel-kv', ttlSeconds: 300 },
        rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 },
        corsProxy: { enabled: true, allowedDomains: ['*'] },
      },
    });
    const result = generateEnvExample(config);
    expect(result).toContain('KV_REST_API_URL=');
    expect(result).toContain('KV_REST_API_TOKEN=');
  });

  it('extracts env references from source headers', () => {
    const config = buildConfig({
      sources: [{
        name: 'api-src', type: 'rest-api', url: 'https://example.com/api', category: 'data',
        tier: 3, interval: 300, language: 'en', tags: [],
        headers: { 'Authorization': 'Bearer ${env.MY_API_KEY}' },
      }],
    });
    const result = generateEnvExample(config);
    expect(result).toContain('MY_API_KEY=');
  });

  it('returns minimal output for config with no env needs', () => {
    const config = buildConfig();
    const result = generateEnvExample(config);
    // No AI enabled, no cache env vars, no source headers
    expect(result.trim()).toBe('');
  });

  it('includes AI vars even when AI disabled (they are always optional)', () => {
    const config = buildConfig({
      ai: {
        enabled: false,
        fallbackChain: ['groq'],
        providers: { groq: { model: 'llama', apiKeyEnv: 'GROQ_API_KEY' } },
        analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false },
      },
    });
    const result = generateEnvExample(config);
    expect(result).toContain('GROQ_API_KEY=');
    expect(result).toContain('(optional)');
  });
});
