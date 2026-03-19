import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerConfigCommands } from '../config.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedExistsSync = vi.mocked(existsSync);

const validConfig = {
  version: '1',
  monitor: { name: 'Test Monitor', slug: 'test-monitor', description: 'A test dashboard', domain: 'technology', tags: ['tech'], branding: { primaryColor: '#0052CC' } },
  sources: [],
  layers: [],
  panels: [],
  views: [],
  ai: { enabled: true, fallbackChain: ['groq'], providers: {}, analysis: { summarization: true, entityExtraction: true, sentimentAnalysis: true, focalPointDetection: false } },
  map: { style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', center: [0, 20], zoom: 3, minZoom: 2, maxZoom: 18, projection: 'mercator', dayNightOverlay: false, atmosphericGlow: true, idleRotation: true, idleRotationSpeed: 0.5 },
  backend: { cache: { provider: 'memory', ttlSeconds: 300 }, rateLimit: { enabled: true, maxRequests: 100, windowSeconds: 60 }, corsProxy: { enabled: true, allowedDomains: ['*'], corsOrigins: ['*'] } },
  build: { target: 'vercel', outDir: 'dist' },
  theme: { mode: 'dark', palette: 'default', colors: {}, panelPosition: 'right', panelWidth: 380, compactMode: false },
};

function createProgram(): Command {
  const program = new Command();
  program
    .option('--format <format>', 'Output format', 'json')
    .option('--dry-run', 'Dry run');
  registerConfigCommands(program);
  return program;
}

class ExitError extends Error {
  constructor(public code: number) { super(`exit ${code}`); }
}

async function runCommand(args: string[]): Promise<string> {
  const outputs: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (msg: string) => outputs.push(msg);
  console.warn = () => {}; // suppress backfill warnings
  const origExit = process.exit;
  process.exit = ((code?: number) => { throw new ExitError(code ?? 0); }) as never;

  try {
    const program = createProgram();
    await program.parseAsync(['node', 'forge', ...args]);
  } catch (err) {
    if (!(err instanceof ExitError)) throw err;
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    process.exit = origExit;
  }

  // Return only the first output (our formatted output), not any commander error messages
  return outputs[0] ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedExistsSync.mockReturnValue(true);
  mockedReadFileSync.mockReturnValue(JSON.stringify(validConfig));
});

// ─── config get ─────────────────────────────────────────────

describe('forge config get', () => {
  it('returns scalar value at dot-path', async () => {
    const output = await runCommand(['config', 'get', 'monitor.name']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data.value).toBe('Test Monitor');
  });

  it('returns full sub-tree at dot-path', async () => {
    const output = await runCommand(['config', 'get', 'monitor']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data.value.name).toBe('Test Monitor');
    expect(result.data.value.slug).toBe('test-monitor');
  });

  it('returns number value correctly', async () => {
    const output = await runCommand(['config', 'get', 'map.zoom']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data.value).toBe(3);
  });

  it('returns boolean value correctly', async () => {
    const output = await runCommand(['config', 'get', 'ai.enabled']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data.value).toBe(true);
  });

  it('fails for non-existent path', async () => {
    const output = await runCommand(['config', 'get', 'nonexistent.path']);
    const result = JSON.parse(output);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns version field', async () => {
    const output = await runCommand(['config', 'get', 'version']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data.value).toBe('1');
  });
});

// ─── config set ─────────────────────────────────────────────

describe('forge config set', () => {
  it('sets string value', async () => {
    const output = await runCommand(['config', 'set', 'monitor.name', 'New Name']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data.value).toBe('New Name');
    expect(mockedWriteFileSync).toHaveBeenCalled();
  });

  it('sets number value via JSON.parse', async () => {
    const output = await runCommand(['config', 'set', 'map.zoom', '5']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data.value).toBe(5);
    // Verify the written config has number, not string
    const writtenJson = String(mockedWriteFileSync.mock.calls[0][1]);
    const writtenConfig = JSON.parse(writtenJson);
    expect(writtenConfig.map.zoom).toBe(5);
    expect(typeof writtenConfig.map.zoom).toBe('number');
  });

  it('sets boolean value via JSON.parse', async () => {
    const output = await runCommand(['config', 'set', 'ai.enabled', 'false']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data.value).toBe(false);
  });

  it('fails with Zod error for invalid value', async () => {
    const output = await runCommand(['config', 'set', 'map.zoom', 'abc']);
    const result = JSON.parse(output);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('VALIDATION_ERROR');
    expect(result.validationErrors).toBeDefined();
    expect(result.validationErrors.length).toBeGreaterThan(0);
  });

  it('warns when key is stripped by Zod validation', async () => {
    const output = await runCommand(['config', 'set', 'monitor.nonexistent', 'foo']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('stripped during validation');
  });

  it('supports --dry-run flag', async () => {
    const output = await runCommand(['--dry-run', 'config', 'set', 'monitor.name', 'Dry Run']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.command).toContain('dry-run');
    // Should NOT have written to disk
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });
});

// ─── version backfill ───────────────────────────────────────

describe('version backfill', () => {
  it('backfills version when config has no version field', async () => {
    const configWithoutVersion = { ...validConfig };
    delete (configWithoutVersion as Record<string, unknown>).version;
    mockedReadFileSync.mockReturnValue(JSON.stringify(configWithoutVersion));

    const output = await runCommand(['config', 'get', 'version']);
    const result = JSON.parse(output);
    expect(result.success).toBe(true);
    expect(result.data.value).toBe('1');
  });
});
