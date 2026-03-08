import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerViewCommands } from './index.js';
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
    panels: [
      { name: 'panel-a', type: 'news-feed', displayName: 'Panel A', position: 0 },
      { name: 'panel-b', type: 'market-ticker', displayName: 'Panel B', position: 1 },
    ],
    views: [],
    ...overrides,
  });
}

function createProgram(): Command {
  const program = new Command();
  program.option('--format <format>');
  program.option('--non-interactive');
  program.option('--dry-run');
  registerViewCommands(program);
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

describe('view add', () => {
  it('creates view with panel membership', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'view', 'add', 'overview',
      '--display-name', 'Overview', '--panels', 'panel-a,panel-b',
      '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('overview');
    expect(output.data.displayName).toBe('Overview');
    expect(output.data.panels).toEqual(['panel-a', 'panel-b']);
    expect(mockedWriteFileSync).toHaveBeenCalled();
  });

  it('validates panels exist in config', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'view', 'add', 'bad-view',
        '--display-name', 'Bad View', '--panels', 'panel-a,nonexistent',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('Unknown panel(s)');
    expect(output.error).toContain('nonexistent');
  });

  it('rejects duplicate view names', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      views: [{ name: 'existing', displayName: 'Existing', panels: ['panel-a'] }],
    }));

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'view', 'add', 'existing',
        '--display-name', 'Existing', '--panels', 'panel-a',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('already exists');
  });

  it('--default clears other defaults', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      views: [{ name: 'old-default', displayName: 'Old', panels: ['panel-a'], default: true }],
    }));

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'view', 'add', 'new-default',
      '--display-name', 'New Default', '--panels', 'panel-b',
      '--default', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('new-default');
    expect(output.data.default).toBe(true);

    // Verify writeFileSync was called with the updated config
    const writtenJson = JSON.parse(
      (mockedWriteFileSync.mock.calls[0][1] as string),
    );
    const oldView = writtenJson.views.find((v: Record<string, unknown>) => v.name === 'old-default');
    expect(oldView.default).toBeUndefined();
    const newView = writtenJson.views.find((v: Record<string, unknown>) => v.name === 'new-default');
    expect(newView.default).toBe(true);
  });

  it('--dry-run shows preview without writing', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', '--dry-run', 'view', 'add', 'dry-view',
      '--display-name', 'Dry View', '--panels', 'panel-a',
      '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toContain('dry-run');
    expect(output.data.name).toBe('dry-view');
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });

  it('rejects invalid name format', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'view', 'add', 'INVALID NAME',
        '--display-name', 'Invalid', '--panels', 'panel-a',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');
  });

  it('rejects empty panels list', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'view', 'add', 'empty-panels',
        '--display-name', 'Empty', '--panels', '',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');
  });
});

describe('view remove', () => {
  it('removes existing view', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      views: [{ name: 'remove-me', displayName: 'Remove Me', panels: ['panel-a'] }],
    }));

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'view', 'remove', 'remove-me', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.remaining).toBe(0);
  });

  it('throws if view not found', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'view', 'remove', 'nonexistent', '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');
  });

  it('--dry-run shows preview without writing', async () => {
    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', '--dry-run', 'view', 'remove', 'some-view', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toContain('dry-run');
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });
});

describe('view list', () => {
  it('lists all views with correct format', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      views: [
        { name: 'overview', displayName: 'Overview', panels: ['panel-a', 'panel-b'], default: true },
        { name: 'markets', displayName: 'Markets', panels: ['panel-b'] },
      ],
    }));

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'view', 'list', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data).toHaveLength(2);
    expect(output.data[0].name).toBe('overview');
    expect(output.data[0].displayName).toBe('Overview');
    expect(output.data[0].panels).toBe('panel-a, panel-b');
    expect(output.data[0].default).toBe('yes');
    expect(output.data[1].name).toBe('markets');
    expect(output.data[1].default).toBe('');
  });

  it('returns empty array when no views', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'view', 'list', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.data).toEqual([]);
  });
});

describe('view set-default', () => {
  it('sets specified view as default', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      views: [
        { name: 'view-a', displayName: 'View A', panels: ['panel-a'] },
        { name: 'view-b', displayName: 'View B', panels: ['panel-b'] },
      ],
    }));

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'view', 'set-default', 'view-a', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('view-a');

    const writtenJson = JSON.parse(
      (mockedWriteFileSync.mock.calls[0][1] as string),
    );
    const viewA = writtenJson.views.find((v: Record<string, unknown>) => v.name === 'view-a');
    expect(viewA.default).toBe(true);
  });

  it('clears other defaults', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig({
      views: [
        { name: 'view-a', displayName: 'View A', panels: ['panel-a'], default: true },
        { name: 'view-b', displayName: 'View B', panels: ['panel-b'] },
      ],
    }));

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'view', 'set-default', 'view-b', '--format', 'json',
    ]);

    const writtenJson = JSON.parse(
      (mockedWriteFileSync.mock.calls[0][1] as string),
    );
    const viewA = writtenJson.views.find((v: Record<string, unknown>) => v.name === 'view-a');
    const viewB = writtenJson.views.find((v: Record<string, unknown>) => v.name === 'view-b');
    expect(viewA.default).toBeUndefined();
    expect(viewB.default).toBe(true);
  });

  it('throws if view not found', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(makeConfig());

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'view', 'set-default', 'nonexistent', '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');
  });

  it('--dry-run shows preview without writing', async () => {
    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', '--dry-run', 'view', 'set-default', 'some-view', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toContain('dry-run');
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });
});
