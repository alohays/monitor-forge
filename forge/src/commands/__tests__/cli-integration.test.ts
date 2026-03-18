import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, readdirSync, chmodSync } from 'node:fs';
import { registerInitCommand } from '../init.js';
import { registerSetupCommand } from '../setup.js';
import { registerStatusCommand } from '../status.js';
import { registerValidateCommand } from '../validate.js';
import { registerSourceCommands } from '../source/index.js';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedExistsSync = vi.mocked(existsSync);
const mockedReaddirSync = vi.mocked(readdirSync);

function makeConfig(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    monitor: { name: 'Test', slug: 'test', domain: 'general' },
    sources: [],
    layers: [],
    panels: [],
    views: [],
    ai: { enabled: false, fallbackChain: [], providers: {} },
    ...overrides,
  });
}

let logOutput: string[];

function createProgram(...registers: Array<(p: Command) => void>): Command {
  const program = new Command();
  program.option('--format <format>', 'Output format', 'json');
  program.option('--non-interactive');
  program.option('--dry-run');
  for (const register of registers) {
    register(program);
  }
  return program;
}

function parseJson(output: string) {
  return JSON.parse(output);
}

beforeEach(() => {
  vi.clearAllMocks();
  logOutput = [];
  vi.spyOn(console, 'log').mockImplementation((msg: string) => { logOutput.push(msg); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`exit:${code}`);
  });
});

// ─── forge init ─────────────────────────────────────────

describe('forge init', () => {
  it('creates config successfully in JSON mode', async () => {
    mockedExistsSync.mockReturnValue(false);

    const program = createProgram(registerInitCommand);
    await program.parseAsync(['node', 'forge', 'init', '--name', 'My Dashboard', '--domain', 'tech', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toBe('init');
    expect(output.data.name).toBe('My Dashboard');
    expect(output.data.domain).toBe('tech');
    expect(output.changes.length).toBeGreaterThan(0);
  });

  it('fails when config exists without --force', async () => {
    mockedExistsSync.mockReturnValue(true);

    const program = createProgram(registerInitCommand);
    await expect(
      program.parseAsync(['node', 'forge', 'init', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('already exists');
    expect(output.error).toContain('--force');
  });

  it('succeeds with --force when config exists', async () => {
    mockedExistsSync.mockReturnValue(true);

    const program = createProgram(registerInitCommand);
    await program.parseAsync(['node', 'forge', 'init', '--name', 'Forced', '--force', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('Forced');
  });

  it('supports --dry-run mode', async () => {
    mockedExistsSync.mockReturnValue(false);

    const program = createProgram(registerInitCommand);
    await program.parseAsync(['node', 'forge', 'init', '--dry-run', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toBe('init --dry-run');
    // Should not have written any files
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });

  it('loads preset when --template specified', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      if (String(path).endsWith('config.json')) return false;
      if (String(path).includes('presets')) return true;
      return false;
    });
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      monitor: { name: 'Tech', slug: 'tech', domain: 'technology', tags: ['tech'] },
      sources: [{ name: 'hn', type: 'rss', url: 'https://hn.com/rss', category: 'tech' }],
      panels: [],
      layers: [],
    }));

    const program = createProgram(registerInitCommand);
    await program.parseAsync(['node', 'forge', 'init', '--template', 'tech-minimal', '--name', 'My Tech', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.sources).toBeGreaterThan(0);
  });
});

// ─── forge setup (non-interactive) ─────────────────────

describe('forge setup (non-interactive)', () => {
  it('creates config with defaults', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedReaddirSync.mockReturnValue([] as any);

    const program = createProgram(registerSetupCommand);
    await program.parseAsync(['node', 'forge', 'setup', '--format', 'json', '--non-interactive']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toBe('setup');
    expect(output.data.name).toBe('My Monitor');
  });

  it('fails when config exists without --force', async () => {
    mockedExistsSync.mockReturnValue(true);

    const program = createProgram(registerSetupCommand);
    await expect(
      program.parseAsync(['node', 'forge', 'setup', '--format', 'json', '--non-interactive']),
    ).rejects.toThrow('exit:1');

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('--force');
  });

  it('succeeds with --force when config exists', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReaddirSync.mockReturnValue([] as any);

    const program = createProgram(registerSetupCommand);
    await program.parseAsync(['node', 'forge', 'setup', '--name', 'Forced Setup', '--force', '--format', 'json', '--non-interactive']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('Forced Setup');
  });
});

// ─── forge status ───────────────────────────────────────

describe('forge status', () => {
  it('returns suggestedActions when no config exists', async () => {
    mockedExistsSync.mockReturnValue(false);

    const program = createProgram(registerStatusCommand);
    await program.parseAsync(['node', 'forge', 'status', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.configExists).toBe(false);
    expect(output.data.suggestedActions).toContainEqual(expect.stringContaining('forge init'));
  });

  it('returns complete state when config is valid', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'feed', type: 'rss', url: 'https://example.com/rss', category: 'news' }],
      panels: [{ name: 'news', type: 'news-feed', displayName: 'News', position: 0 }],
      views: [{ name: 'main', displayName: 'Main', panels: ['news'], default: true }],
    }));

    const program = createProgram(registerStatusCommand);
    await program.parseAsync(['node', 'forge', 'status', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.configExists).toBe(true);
    expect(output.data.configValid).toBe(true);
    expect(output.data.sources).toBe(1);
    expect(output.data.panels).toBe(1);
    expect(output.data.views).toBe(1);
  });

  it('suggests adding sources when none exist', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram(registerStatusCommand);
    await program.parseAsync(['node', 'forge', 'status', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.data.suggestedActions).toContainEqual(expect.stringContaining('source add'));
  });

  it('suggests adding views when panels exist but views do not', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'feed', type: 'rss', url: 'https://example.com/rss', category: 'news' }],
      panels: [{ name: 'news', type: 'news-feed', displayName: 'News', position: 0 }],
    }));

    const program = createProgram(registerStatusCommand);
    await program.parseAsync(['node', 'forge', 'status', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.data.suggestedActions).toContainEqual(expect.stringContaining('view add'));
  });

  it('handles invalid config gracefully', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue('{ invalid json }');

    const program = createProgram(registerStatusCommand);
    await program.parseAsync(['node', 'forge', 'status', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.data.configExists).toBe(true);
    expect(output.data.configValid).toBe(false);
    expect(output.data.configError).toBeDefined();
    expect(output.data.suggestedActions).toContainEqual(expect.stringContaining('validate'));
  });
});

// ─── forge validate ─────────────────────────────────────

describe('forge validate (JSON output)', () => {
  it('returns valid: true in JSON for well-formed config', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'feed', type: 'rss', url: 'https://example.com/rss', category: 'news' }],
      panels: [{ name: 'news', type: 'news-feed', displayName: 'News', position: 0 }],
      views: [{ name: 'main', displayName: 'Main', panels: ['news'] }],
    }));

    const program = createProgram(registerValidateCommand);
    await program.parseAsync(['node', 'forge', 'validate', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.valid).toBe(true);
    expect(output.data.views).toBe(1);
  });

  it('uses structuredFailure for Zod errors', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ monitor: {} }));

    const program = createProgram(registerValidateCommand);
    await expect(
      program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.errorCode).toBe('VALIDATION_ERROR');
    expect(output.validationErrors).toBeDefined();
    expect(output.validationErrors.length).toBeGreaterThan(0);
    expect(output.recovery).toBeDefined();
  });

  it('returns table format for human-readable output', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'feed', type: 'rss', url: 'https://example.com/rss', category: 'news' }],
      panels: [{ name: 'news', type: 'news-feed', displayName: 'News', position: 0 }],
    }));

    const program = createProgram(registerValidateCommand);
    await program.parseAsync(['node', 'forge', 'validate', '--format', 'table']);

    // Table output should not be valid JSON
    expect(() => JSON.parse(logOutput[0])).toThrow();
    expect(logOutput[0]).toContain('valid');
  });
});

// ─── forge source add / remove ──────────────────────────

describe('forge source add', () => {
  it('adds a source in JSON mode', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram(registerSourceCommands);
    await program.parseAsync([
      'node', 'forge', 'source', 'add', 'rss',
      '--name', 'my-feed',
      '--url', 'https://example.com/rss',
      '--category', 'news',
      '--format', 'json',
    ]);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('my-feed');
    expect(output.data.action).toBe('created');
  });

  it('errors on duplicate without --upsert', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'my-feed', type: 'rss', url: 'https://old.com/rss', category: 'news' }],
    }));

    const program = createProgram(registerSourceCommands);
    await expect(
      program.parseAsync([
        'node', 'forge', 'source', 'add', 'rss',
        '--name', 'my-feed',
        '--url', 'https://new.com/rss',
        '--category', 'tech',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('already exists');
  });

  it('updates existing source with --upsert', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'my-feed', type: 'rss', url: 'https://old.com/rss', category: 'news' }],
    }));

    const program = createProgram(registerSourceCommands);
    await program.parseAsync([
      'node', 'forge', 'source', 'add', 'rss',
      '--name', 'my-feed',
      '--url', 'https://new.com/rss',
      '--category', 'tech',
      '--upsert',
      '--format', 'json',
    ]);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.action).toBe('updated');
    expect(output.data.url).toBe('https://new.com/rss');
  });

  it('creates new source with --upsert when not existing', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram(registerSourceCommands);
    await program.parseAsync([
      'node', 'forge', 'source', 'add', 'rss',
      '--name', 'new-feed',
      '--url', 'https://example.com/rss',
      '--category', 'news',
      '--upsert',
      '--format', 'json',
    ]);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.action).toBe('created');
  });
});

describe('forge source remove', () => {
  it('removes an existing source', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'my-feed', type: 'rss', url: 'https://example.com/rss', category: 'news' }],
    }));

    const program = createProgram(registerSourceCommands);
    await program.parseAsync(['node', 'forge', 'source', 'remove', 'my-feed', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('my-feed');
  });

  it('errors when source not found', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram(registerSourceCommands);
    await expect(
      program.parseAsync(['node', 'forge', 'source', 'remove', 'nonexistent', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('not found');
  });
});
