import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerPanelCommands } from './index.js';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { loadConfig, updateConfig } from '../../config/loader.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

vi.mock('../../config/loader.js', () => ({
  loadConfig: vi.fn(),
  updateConfig: vi.fn(),
}));

const mockedExistsSync = vi.mocked(existsSync);
const mockedMkdirSync = vi.mocked(mkdirSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedUnlinkSync = vi.mocked(unlinkSync);
const mockedLoadConfig = vi.mocked(loadConfig);
const mockedUpdateConfig = vi.mocked(updateConfig);

function makeConfig(overrides?: Record<string, unknown>) {
  return {
    monitor: { name: 'Test', slug: 'test', domain: 'general' },
    sources: [],
    layers: [],
    panels: [],
    views: [],
    ai: {},
    map: {},
    backend: {},
    build: {},
    ...overrides,
  };
}

function createProgram(): Command {
  const program = new Command();
  program.option('--format <format>');
  program.option('--non-interactive');
  program.option('--dry-run');
  registerPanelCommands(program);
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

// ─── panel create ───────────────────────────────────────────

describe('panel create', () => {
  it('rejects invalid name format (special chars)', async () => {
    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'panel', 'create', 'INVALID NAME',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('lowercase alphanumeric with hyphens');
  });

  it('rejects invalid name format (path traversal)', async () => {
    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'panel', 'create', '../evil',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
  });

  it('rejects if file already exists', async () => {
    mockedExistsSync.mockReturnValue(true);
    mockedLoadConfig.mockReturnValue(makeConfig() as any);

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'panel', 'create', 'my-panel',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('already exists');
  });

  it('scaffolds file in correct directory and registers in config', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedLoadConfig.mockReturnValue(makeConfig() as any);
    mockedUpdateConfig.mockReturnValue({ config: makeConfig() as any, path: 'monitor-forge.config.json' });

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'panel', 'create', 'my-panel',
      '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('my-panel');
    expect(output.data.className).toBe('MyPanel');
    expect(output.data.file).toBe('src/custom-panels/MyPanel.ts');

    // File scaffold was written
    expect(mockedMkdirSync).toHaveBeenCalled();
    expect(mockedWriteFileSync).toHaveBeenCalledTimes(1);
    const writtenContent = mockedWriteFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain('class MyPanel extends PanelBase');

    // Config was updated
    expect(mockedUpdateConfig).toHaveBeenCalledTimes(1);
  });

  it('--no-register skips config update', async () => {
    mockedExistsSync.mockReturnValue(false);

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'panel', 'create', 'my-panel',
      '--no-register',
      '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(mockedWriteFileSync).toHaveBeenCalledTimes(1);
    expect(mockedLoadConfig).not.toHaveBeenCalled();
    expect(mockedUpdateConfig).not.toHaveBeenCalled();
  });

  it('--dry-run shows preview without writing', async () => {
    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', '--dry-run', 'panel', 'create', 'my-panel',
      '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toContain('dry-run');
    expect(output.data.className).toBe('MyPanel');
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
    expect(mockedMkdirSync).not.toHaveBeenCalled();
    expect(mockedUpdateConfig).not.toHaveBeenCalled();
  });

  it('rejects duplicate name in config', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedLoadConfig.mockReturnValue(makeConfig({
      panels: [{ name: 'my-panel', type: 'custom', displayName: 'My Panel', position: 0, config: {}, customModule: 'MyPanel' }],
    }) as any);

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'panel', 'create', 'my-panel',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('already exists in config');
  });

  it('rollback: cleans up file if config update fails', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedLoadConfig.mockReturnValue(makeConfig() as any);
    mockedUpdateConfig.mockImplementation(() => {
      throw new Error('Config write failed');
    });

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'panel', 'create', 'my-panel',
        '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    // File was written first
    expect(mockedWriteFileSync).toHaveBeenCalledTimes(1);
    // Then rolled back via unlinkSync
    expect(mockedUnlinkSync).toHaveBeenCalledTimes(1);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('Config write failed');
  });

  it('--position sets custom position', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedLoadConfig.mockReturnValue(makeConfig() as any);
    mockedUpdateConfig.mockReturnValue({ config: makeConfig() as any, path: 'monitor-forge.config.json' });

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'panel', 'create', 'my-panel',
      '--position', '5',
      '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);

    // Verify the updater was called; inspect the panelConfig via the updateConfig call
    const updater = mockedUpdateConfig.mock.calls[0][0];
    const baseConfig = makeConfig() as any;
    const result = updater(baseConfig);
    const addedPanel = result.panels[result.panels.length - 1];
    expect(addedPanel.position).toBe(5);
  });

  it('--display-name overrides default display name', async () => {
    mockedExistsSync.mockReturnValue(false);
    mockedLoadConfig.mockReturnValue(makeConfig() as any);
    mockedUpdateConfig.mockReturnValue({ config: makeConfig() as any, path: 'monitor-forge.config.json' });

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'panel', 'create', 'my-panel',
      '--display-name', 'Custom Display Name',
      '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);

    // Verify displayName in scaffold file content
    const writtenContent = mockedWriteFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toContain('Custom Display Name');

    // Verify displayName in config updater
    const updater = mockedUpdateConfig.mock.calls[0][0];
    const baseConfig = makeConfig() as any;
    const result = updater(baseConfig);
    const addedPanel = result.panels[result.panels.length - 1];
    expect(addedPanel.displayName).toBe('Custom Display Name');
  });
});

// ─── panel add ──────────────────────────────────────────────

describe('panel add', () => {
  it('adds valid panel to config', async () => {
    mockedUpdateConfig.mockReturnValue({ config: makeConfig() as any, path: 'monitor-forge.config.json' });

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'panel', 'add', 'news-feed',
      '--name', 'my-feed', '--display-name', 'My Feed',
      '--position', '0', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('my-feed');
    expect(output.data.type).toBe('news-feed');
    expect(output.data.displayName).toBe('My Feed');
    expect(mockedUpdateConfig).toHaveBeenCalled();
  });

  it('rejects invalid panel type via schema validation', async () => {
    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'panel', 'add', 'invalid-type',
        '--name', 'my-panel', '--display-name', 'My Panel',
        '--position', '0', '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
  });

  it('rejects duplicate panel name', async () => {
    mockedUpdateConfig.mockImplementation(() => {
      throw new Error('Panel "existing-panel" already exists');
    });

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'panel', 'add', 'news-feed',
        '--name', 'existing-panel', '--display-name', 'Existing',
        '--position', '0', '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('already exists');
  });

  it('rejects invalid panel name format', async () => {
    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'panel', 'add', 'news-feed',
        '--name', 'BAD NAME', '--display-name', 'Bad',
        '--position', '0', '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
  });

  it('supports --source option', async () => {
    mockedUpdateConfig.mockReturnValue({ config: makeConfig() as any, path: 'monitor-forge.config.json' });

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'panel', 'add', 'news-feed',
      '--name', 'my-feed', '--display-name', 'My Feed',
      '--position', '0', '--source', 'rss-source',
      '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.config.source).toBe('rss-source');
  });

  it('supports dry-run mode', async () => {
    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', '--dry-run', 'panel', 'add', 'news-feed',
      '--name', 'my-feed', '--display-name', 'My Feed',
      '--position', '0', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toContain('dry-run');
    expect(mockedUpdateConfig).not.toHaveBeenCalled();
  });

  it('supports --config-json option', async () => {
    mockedUpdateConfig.mockReturnValue({ config: makeConfig() as any, path: 'monitor-forge.config.json' });

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'panel', 'add', 'market-ticker',
      '--name', 'ticker', '--display-name', 'Ticker',
      '--position', '1',
      '--config-json', '{"symbols":["BTC","ETH"]}',
      '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.config.symbols).toEqual(['BTC', 'ETH']);
  });
});

// ─── panel remove ───────────────────────────────────────────

describe('panel remove', () => {
  it('removes existing panel from config', async () => {
    mockedUpdateConfig.mockReturnValue({
      config: makeConfig({ panels: [] }) as any,
      path: 'monitor-forge.config.json',
    });

    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', 'panel', 'remove', 'my-panel', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.name).toBe('my-panel');
    expect(output.data.remaining).toBe(0);
  });

  it('throws if panel not found', async () => {
    mockedUpdateConfig.mockImplementation(() => {
      throw new Error('Panel "nonexistent" not found');
    });

    const program = createProgram();
    await expect(
      program.parseAsync([
        'node', 'forge', 'panel', 'remove', 'nonexistent', '--format', 'json',
      ]),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('not found');
  });

  it('supports dry-run mode', async () => {
    const program = createProgram();
    await program.parseAsync([
      'node', 'forge', '--dry-run', 'panel', 'remove', 'my-panel', '--format', 'json',
    ]);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toContain('dry-run');
    expect(mockedUpdateConfig).not.toHaveBeenCalled();
  });
});

// ─── panel list ─────────────────────────────────────────────

describe('panel list', () => {
  it('lists all panels from config', async () => {
    mockedLoadConfig.mockReturnValue(makeConfig({
      panels: [
        { name: 'brief', type: 'ai-brief', displayName: 'AI Brief', position: 0, config: {} },
        { name: 'feed', type: 'news-feed', displayName: 'News Feed', position: 1, config: {} },
      ],
    }) as any);

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'panel', 'list', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data).toHaveLength(2);
    expect(output.data[0].name).toBe('brief');
    expect(output.data[0].type).toBe('ai-brief');
    expect(output.data[0].displayName).toBe('AI Brief');
    expect(output.data[0].position).toBe(0);
    expect(output.data[1].name).toBe('feed');
    expect(output.data[1].type).toBe('news-feed');
  });

  it('returns empty array when no panels', async () => {
    mockedLoadConfig.mockReturnValue(makeConfig() as any);

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'panel', 'list', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data).toEqual([]);
  });

  it('errors when config cannot be loaded', async () => {
    mockedLoadConfig.mockImplementation(() => {
      throw new Error('Config file not found');
    });

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'panel', 'list', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('Config file not found');
  });
});
