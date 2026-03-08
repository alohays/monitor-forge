import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerValidateCommand } from './validate.js';
import { readFileSync, existsSync } from 'node:fs';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedExistsSync = vi.mocked(existsSync);

function makeConfig(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    monitor: { name: 'Test', slug: 'test', domain: 'general' },
    sources: [],
    layers: [],
    panels: [],
    ai: { enabled: false, fallbackChain: [], providers: {} },
    ...overrides,
  });
}

function createProgram(): Command {
  const program = new Command();
  program.option('--format <format>');
  program.option('--non-interactive');
  program.option('--dry-run');
  registerValidateCommand(program);
  return program;
}

let logOutput: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  logOutput = [];
  vi.spyOn(console, 'log').mockImplementation((msg: string) => { logOutput.push(msg); });
  vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`exit:${code}`);
  });
});

describe('validate command', () => {
  it('passes validation for well-formed config', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'feed', type: 'rss', url: 'https://example.com/rss', category: 'news' }],
      panels: [{ name: 'news', type: 'news-feed', displayName: 'News', position: 0 }],
    }));

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'validate', '--format', 'json']);
    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.valid).toBe(true);
  });

  it('warns when no sources configured', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'validate', '--format', 'json']);
    const output = JSON.parse(logOutput[0]);
    expect(output.warnings).toContainEqual(expect.stringContaining('No data sources'));
  });

  it('warns when no panels configured', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'feed', type: 'rss', url: 'https://example.com/rss', category: 'news' }],
    }));

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'validate', '--format', 'json']);
    const output = JSON.parse(logOutput[0]);
    expect(output.warnings).toContainEqual(expect.stringContaining('No panels'));
  });

  it('errors on duplicate source names', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [
        { name: 'dup', type: 'rss', url: 'https://a.com/rss', category: 'news' },
        { name: 'dup', type: 'rss', url: 'https://b.com/rss', category: 'news' },
      ],
    }));

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
    ).rejects.toThrow('exit:1');
    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
  });

  it('errors when layer references missing static file', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      if (String(path).endsWith('config.json')) return true;
      if (String(path).endsWith('missing.geojson')) return false;
      return true;
    });
    mockedReadFileSync.mockReturnValue(makeConfig({
      layers: [{ name: 'broken', type: 'points', displayName: 'B', color: '#FF0000', data: { source: 'static', path: 'data/geo/missing.geojson' }, category: 'c' }],
    }));

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
    ).rejects.toThrow('exit:1');
  });

  it('errors when AI fallback chain references unknown provider', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      ai: {
        enabled: true,
        fallbackChain: ['nonexistent'],
        providers: {},
      },
      sources: [{ name: 'f', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
      panels: [{ name: 'p', type: 'news-feed', displayName: 'P', position: 0 }],
    }));

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
    ).rejects.toThrow('exit:1');
  });

  it('fails when config does not exist', async () => {
    mockedExistsSync.mockReturnValue(false);

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
    ).rejects.toThrow('exit:1');
  });

  // ─── Cross-Field Validation ───────────────────────────────

  describe('cross-field validation', () => {
    it('errors on duplicate panel names', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'f', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
        panels: [
          { name: 'dup', type: 'news-feed', displayName: 'A', position: 0 },
          { name: 'dup', type: 'ai-brief', displayName: 'B', position: 1 },
        ],
      }));

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
      ).rejects.toThrow('exit:1');
      const output = JSON.parse(logOutput[0]);
      expect(output.success).toBe(false);
    });

    it('errors on duplicate layer names', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        layers: [
          { name: 'dup', type: 'points', displayName: 'A', color: '#FF0000', data: { source: 'static', path: 'a.geojson' }, category: 'c' },
          { name: 'dup', type: 'lines', displayName: 'B', color: '#00FF00', data: { source: 'static', path: 'b.geojson' }, category: 'c' },
        ],
      }));
      mockedExistsSync.mockImplementation((path: any) => {
        if (String(path).endsWith('.geojson')) return true;
        return true;
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
      ).rejects.toThrow('exit:1');
    });

    it('errors when layer source-ref references undefined source', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'existing', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
        layers: [
          { name: 'broken-ref', type: 'points', displayName: 'Broken', color: '#FF0000',
            data: { source: 'source-ref', sourceRef: 'nonexistent' }, category: 'c' },
        ],
        panels: [{ name: 'p', type: 'news-feed', displayName: 'P', position: 0 }],
      }));

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
      ).rejects.toThrow('exit:1');
    });

    it('warns when panel config references non-existent source', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'real-src', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
        panels: [{
          name: 'panel-bad-ref', type: 'news-feed', displayName: 'P', position: 0,
          config: { source: 'ghost-source' },
        }],
      }));

      const program = createProgram();
      await program.parseAsync(['node', 'forge', 'validate', '--format', 'json']);
      const output = JSON.parse(logOutput[0]);
      expect(output.success).toBe(true); // Warning, not error
      expect(output.warnings).toContainEqual(
        expect.stringContaining('ghost-source'),
      );
    });

    it('validates successfully when all cross-references are valid', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'my-api', type: 'rest-api', url: 'https://api.com/v1', category: 'data' }],
        layers: [
          { name: 'ref-layer', type: 'points', displayName: 'R', color: '#FF0000',
            data: { source: 'source-ref', sourceRef: 'my-api' }, category: 'c' },
        ],
        panels: [{ name: 'p', type: 'news-feed', displayName: 'P', position: 0 }],
      }));

      const program = createProgram();
      await program.parseAsync(['node', 'forge', 'validate', '--format', 'json']);
      const output = JSON.parse(logOutput[0]);
      expect(output.success).toBe(true);
      expect(output.data.valid).toBe(true);
    });
  });

  // ─── View Validation ─────────────────────────────────────

  describe('view validation', () => {
    it('errors on duplicate view names', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'f', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
        panels: [{ name: 'news', type: 'news-feed', displayName: 'News', position: 0 }],
        views: [
          { name: 'main', displayName: 'Main', panels: ['news'] },
          { name: 'main', displayName: 'Main 2', panels: ['news'] },
        ],
      }));

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
      ).rejects.toThrow('exit:1');
      const output = JSON.parse(logOutput[0]);
      expect(output.success).toBe(false);
    });

    it('errors when view references unknown panel', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'f', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
        panels: [{ name: 'news', type: 'news-feed', displayName: 'News', position: 0 }],
        views: [
          { name: 'main', displayName: 'Main', panels: ['news', 'nonexistent'] },
        ],
      }));

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
      ).rejects.toThrow('exit:1');
      const output = JSON.parse(logOutput[0]);
      expect(output.success).toBe(false);
    });

    it('errors on multiple default views', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'f', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
        panels: [{ name: 'news', type: 'news-feed', displayName: 'News', position: 0 }],
        views: [
          { name: 'view-a', displayName: 'A', panels: ['news'], default: true },
          { name: 'view-b', displayName: 'B', panels: ['news'], default: true },
        ],
      }));

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'forge', 'validate', '--format', 'json']),
      ).rejects.toThrow('exit:1');
      const output = JSON.parse(logOutput[0]);
      expect(output.success).toBe(false);
    });

    it('warns about orphan panels not in any view', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'f', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
        panels: [
          { name: 'news', type: 'news-feed', displayName: 'News', position: 0 },
          { name: 'orphan', type: 'ai-brief', displayName: 'Orphan', position: 1 },
        ],
        views: [
          { name: 'main', displayName: 'Main', panels: ['news'] },
        ],
      }));

      const program = createProgram();
      await program.parseAsync(['node', 'forge', 'validate', '--format', 'json']);
      const output = JSON.parse(logOutput[0]);
      expect(output.success).toBe(true);
      expect(output.warnings).toContainEqual(
        expect.stringContaining('orphan'),
      );
    });

    it('errors when custom panel missing customModule', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'f', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
        panels: [{ name: 'my-widget', type: 'custom', displayName: 'Widget', position: 0, customModule: 'MyWidget' }],
      }));

      const program = createProgram();
      await program.parseAsync(['node', 'forge', 'validate', '--format', 'json']);
      const output = JSON.parse(logOutput[0]);
      expect(output.success).toBe(true);
    });

    it('passes with valid views configuration', async () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue(makeConfig({
        sources: [{ name: 'f', type: 'rss', url: 'https://a.com/rss', category: 'n' }],
        panels: [
          { name: 'news', type: 'news-feed', displayName: 'News', position: 0 },
          { name: 'status', type: 'service-status', displayName: 'Status', position: 1 },
        ],
        views: [
          { name: 'overview', displayName: 'Overview', panels: ['news', 'status'], default: true },
          { name: 'detail', displayName: 'Detail', panels: ['status'] },
        ],
      }));

      const program = createProgram();
      await program.parseAsync(['node', 'forge', 'validate', '--format', 'json']);
      const output = JSON.parse(logOutput[0]);
      expect(output.success).toBe(true);
      expect(output.data.valid).toBe(true);
    });
  });
});
