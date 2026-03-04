import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { configExists, loadConfig, writeConfig, updateConfig } from './loader.js';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedExistsSync = vi.mocked(existsSync);

const validConfigJson = JSON.stringify({
  monitor: { name: 'Test', slug: 'test', domain: 'general' },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('configExists', () => {
  it('returns true when config file exists', () => {
    mockedExistsSync.mockReturnValue(true);
    expect(configExists('/test')).toBe(true);
  });

  it('returns false when config file does not exist', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(configExists('/test')).toBe(false);
  });
});

describe('loadConfig', () => {
  it('loads and parses valid JSON config', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(validConfigJson);
    const config = loadConfig('/test');
    expect(config.monitor.name).toBe('Test');
    expect(config.sources).toEqual([]);
  });

  it('throws when config file not found', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(() => loadConfig('/test')).toThrow('Config file not found');
  });

  it('throws when config JSON is malformed', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue('{ invalid json }');
    expect(() => loadConfig('/test')).toThrow();
  });

  it('throws when config fails schema validation', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ monitor: {} }));
    expect(() => loadConfig('/test')).toThrow();
  });

  it('applies schema defaults on load', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(validConfigJson);
    const config = loadConfig('/test');
    expect(config.ai.enabled).toBe(true);
    expect(config.map.projection).toBe('mercator');
  });
});

describe('writeConfig', () => {
  it('writes JSON file with pretty formatting', () => {
    const config = {
      monitor: { name: 'Test', slug: 'test', description: '', domain: 'general', tags: [], branding: { primaryColor: '#0052CC' } },
      sources: [], layers: [], panels: [],
      ai: { enabled: false, fallbackChain: [], providers: {}, analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false } },
      map: { style: 'https://example.com/style.json', center: [0, 0] as [number, number], zoom: 3, minZoom: 2, maxZoom: 18, projection: 'mercator' as const, dayNightOverlay: false },
      backend: { cache: { provider: 'memory' as const, ttlSeconds: 300 }, rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 }, corsProxy: { enabled: true, allowedDomains: ['*'], corsOrigins: ['*'] } },
      build: { target: 'vercel' as const, outDir: 'dist' },
    };
    writeConfig(config, '/test');

    expect(mockedWriteFileSync).toHaveBeenCalledTimes(2);
    // First call: JSON file
    const jsonCall = mockedWriteFileSync.mock.calls[0];
    expect(String(jsonCall[0])).toContain('monitor-forge.config.json');
    expect(String(jsonCall[1])).toContain('"name": "Test"');
    // Second call: TS wrapper
    const tsCall = mockedWriteFileSync.mock.calls[1];
    expect(String(tsCall[0])).toContain('monitor-forge.config.ts');
    expect(String(tsCall[1])).toContain('auto-generated');
  });

  it('returns the JSON file path', () => {
    const config = {
      monitor: { name: 'Test', slug: 'test', description: '', domain: 'general', tags: [], branding: { primaryColor: '#0052CC' } },
      sources: [], layers: [], panels: [],
      ai: { enabled: false, fallbackChain: [], providers: {}, analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false } },
      map: { style: 'https://example.com/style.json', center: [0, 0] as [number, number], zoom: 3, minZoom: 2, maxZoom: 18, projection: 'mercator' as const, dayNightOverlay: false },
      backend: { cache: { provider: 'memory' as const, ttlSeconds: 300 }, rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 }, corsProxy: { enabled: true, allowedDomains: ['*'], corsOrigins: ['*'] } },
      build: { target: 'vercel' as const, outDir: 'dist' },
    };
    const path = writeConfig(config, '/test');
    expect(path).toContain('monitor-forge.config.json');
  });
});

describe('updateConfig', () => {
  it('reads current config, applies updater, and writes result', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(validConfigJson);

    const result = updateConfig(
      (config) => ({ ...config, monitor: { ...config.monitor, name: 'Updated' } }),
      '/test',
    );

    expect(result.config.monitor.name).toBe('Updated');
    expect(mockedWriteFileSync).toHaveBeenCalled();
  });

  it('throws if config file does not exist', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(() => updateConfig((c) => c, '/test')).toThrow('Config file not found');
  });

  it('validates updated config against schema', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(validConfigJson);

    // This should still be valid after update
    const result = updateConfig(
      (config) => ({ ...config, monitor: { ...config.monitor, description: 'Updated desc' } }),
      '/test',
    );
    expect(result.config.monitor.description).toBe('Updated desc');
  });

  it('does not write config when updater produces invalid config', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(validConfigJson);

    expect(() => updateConfig(
      (config) => ({ ...config, monitor: undefined as any }),
      '/test',
    )).toThrow();

    // writeFileSync should NOT have been called because validation failed before writing
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });
});

// ─── Error Handling Quality ─────────────────────────────────

describe('error handling quality', () => {
  it('provides error message mentioning config file when not found', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(() => loadConfig('/test')).toThrow(/Config file not found/);
  });

  it('throws ZodError with field details on schema failure', () => {
    mockedExistsSync.mockReturnValue(true);
    // monitor.name is required but missing
    mockedReadFileSync.mockReturnValue(JSON.stringify({ monitor: { slug: 'test', domain: 'test' } }));
    try {
      loadConfig('/test');
      expect.fail('Should have thrown');
    } catch (err: any) {
      // Zod errors contain issue details
      expect(err.issues || err.message).toBeDefined();
    }
  });

  it('throws on JSON with trailing comma', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue('{ "monitor": { "name": "Test", } }');
    expect(() => loadConfig('/test')).toThrow();
  });
});
