import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { registerApplyCommand } from '../apply.js';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedExistsSync = vi.mocked(existsSync);

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

function createProgram(): Command {
  const program = new Command();
  program.option('--format <format>', 'Output format', 'json');
  program.option('--non-interactive');
  program.option('--dry-run');
  registerApplyCommand(program);
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
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`exit:${code}`);
  });
});

describe('forge apply', () => {
  it('applies a patch file to existing config', async () => {
    // Config file exists
    mockedExistsSync.mockImplementation((path: any) => {
      if (String(path).endsWith('.json')) return true;
      return false;
    });
    // First read: patch file, second read: config file
    mockedReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.includes('patch')) {
        return JSON.stringify({
          sources: [{ name: 'new-feed', type: 'rss', url: 'https://example.com/rss', category: 'news' }],
        });
      }
      return makeConfig();
    });

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'apply', 'patch.json', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toBe('apply');
    expect(output.data.totalChanges).toBeGreaterThan(0);
    expect(output.data.changes).toContainEqual(
      expect.objectContaining({ type: 'added', path: 'sources', name: 'new-feed' }),
    );
  });

  it('supports --dry-run flag', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      if (String(path).endsWith('.json')) return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.includes('patch')) {
        return JSON.stringify({
          theme: { palette: 'ocean' },
        });
      }
      return makeConfig();
    });

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'apply', 'patch.json', '--dry-run', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toBe('apply --dry-run');
    // Should NOT have written any files
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });

  it('fails when patch file does not exist', async () => {
    mockedExistsSync.mockReturnValue(false);

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'apply', 'nonexistent.json', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('not found');
  });

  it('fails when patch file contains invalid JSON', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.includes('bad-patch')) return '{ invalid json }';
      return makeConfig();
    });

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'apply', 'bad-patch.json', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('Invalid JSON');
  });

  it('fails when merged config fails Zod validation', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      if (String(path).endsWith('.json')) return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.includes('bad-merge')) {
        // This will corrupt the monitor field
        return JSON.stringify({ monitor: { name: '', slug: '' } });
      }
      return makeConfig();
    });

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'apply', 'bad-merge.json', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.errorCode).toBe('VALIDATION_ERROR');
  });

  it('outputs changes with file path and next steps', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      if (String(path).endsWith('.json')) return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.includes('patch')) {
        return JSON.stringify({
          sources: [{ name: 'feed-a', type: 'rss', url: 'https://a.com/rss', category: 'tech' }],
        });
      }
      return makeConfig();
    });

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'apply', 'patch.json', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.changes).toHaveLength(1);
    expect(output.changes[0].description).toContain('change');
    expect(output.next_steps).toContain('forge validate');
  });

  it('handles empty patch gracefully', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      if (String(path).endsWith('.json')) return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.includes('empty')) return JSON.stringify({});
      return makeConfig();
    });

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'apply', 'empty.json', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.totalChanges).toBe(0);
  });

  it('handles delete markers in patch', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      if (String(path).endsWith('.json')) return true;
      return false;
    });
    mockedReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.includes('delete')) {
        return JSON.stringify({
          sources: [{ name: 'old-feed', _delete: true }],
        });
      }
      return makeConfig({
        sources: [{ name: 'old-feed', type: 'rss', url: 'https://old.com/rss', category: 'news' }],
      });
    });

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'apply', 'delete.json', '--format', 'json']);

    const output = parseJson(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.changes).toContainEqual(
      expect.objectContaining({ type: 'removed', name: 'old-feed' }),
    );
  });
});
