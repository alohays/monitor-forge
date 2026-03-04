import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerSourceCommands } from './index.js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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
    ...overrides,
  });
}

function createProgram(): Command {
  const program = new Command();
  program.option('--format <format>');
  program.option('--non-interactive');
  program.option('--dry-run');
  registerSourceCommands(program);
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

describe('source add', () => {
  it('adds valid RSS source to config', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'source', 'add', 'rss',
      '--name', 'test-feed', '--url', 'https://example.com/rss.xml',
      '--category', 'news', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('test-feed');
    expect(output.data.type).toBe('rss');
    expect(mockedWriteFileSync).toHaveBeenCalled();
  });

  it('rejects duplicate source name', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'existing', type: 'rss', url: 'https://a.com/rss', category: 'news' }],
    }));

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'source', 'add', 'rss',
        '--name', 'existing', '--url', 'https://b.com/rss',
        '--category', 'news', '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');
    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('already exists');
  });

  it('validates source schema (rejects invalid name)', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'source', 'add', 'rss',
        '--name', 'INVALID NAME', '--url', 'https://example.com/rss',
        '--category', 'news', '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');
  });

  it('supports dry-run mode', async () => {
    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', '--dry-run', 'source', 'add', 'rss',
      '--name', 'dry-feed', '--url', 'https://example.com/rss',
      '--category', 'news', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toContain('dry-run');
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });
});

describe('source remove', () => {
  it('removes existing source', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [{ name: 'remove-me', type: 'rss', url: 'https://a.com/rss', category: 'news' }],
    }));

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'source', 'remove', 'remove-me', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.remaining).toBe(0);
  });

  it('errors when source not found', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'source', 'remove', 'nonexistent', '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');
  });
});

describe('source list', () => {
  it('lists all sources from config', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      sources: [
        { name: 'feed-1', type: 'rss', url: 'https://a.com/rss', category: 'news' },
        { name: 'feed-2', type: 'rest-api', url: 'https://b.com/api', category: 'data' },
      ],
    }));

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'source', 'list', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data).toHaveLength(2);
    expect(output.data[0].name).toBe('feed-1');
    expect(output.data[1].name).toBe('feed-2');
  });

  it('returns empty array when no sources', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'source', 'list', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.data).toEqual([]);
  });
});
