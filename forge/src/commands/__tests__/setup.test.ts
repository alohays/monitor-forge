import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerSetupCommand } from '../setup.js';
import { readFileSync, writeFileSync, existsSync, readdirSync, chmodSync } from 'node:fs';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
  realpathSync: vi.fn((p: string) => p),
}));

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
  log: { step: vi.fn(), info: vi.fn(), success: vi.fn(), warn: vi.fn() },
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}));

const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedExistsSync = vi.mocked(existsSync);
const mockedReaddirSync = vi.mocked(readdirSync);

const techMinimalPreset = JSON.stringify({
  monitor: { name: 'Tech Watch', slug: 'tech-watch', domain: 'technology', description: 'Tech dashboard', tags: [], branding: { primaryColor: '#0052CC' } },
  sources: [
    { name: 'hackernews', type: 'rss', url: 'https://hn.algolia.com/api/v1/search', category: 'tech' },
    { name: 'techcrunch', type: 'rss', url: 'https://techcrunch.com/feed/', category: 'tech' },
    { name: 'arstechnica', type: 'rss', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech' },
  ],
  panels: [
    { name: 'tech-news', type: 'news-feed', displayName: 'Tech News', position: 0 },
    { name: 'ai-brief', type: 'ai-brief', displayName: 'AI Brief', position: 1 },
  ],
  layers: [],
  ai: { enabled: true, fallbackChain: ['groq'], providers: { groq: { model: 'llama-3.3-70b-versatile', apiKeyEnv: 'GROQ_API_KEY' } } },
  map: { center: [-95, 38], projection: 'mercator' },
});

function createProgram(): Command {
  const program = new Command();
  program.option('--format <format>');
  program.option('--non-interactive');
  program.option('--dry-run');
  registerSetupCommand(program);
  return program;
}

let logOutput: string[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  logOutput = [];
  vi.spyOn(console, 'log').mockImplementation((msg: string) => { logOutput.push(msg); });
  vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`exit:${code}`);
  });
});

function mockNoExistingConfig() {
  mockedExistsSync.mockImplementation((path: any) => {
    const p = String(path);
    if (p.endsWith('config.json')) return false;
    if (p.endsWith('config.ts')) return false;
    if (p.endsWith('.env.local')) return false;
    if (p.endsWith('presets')) return true;
    if (p.endsWith('.json')) return true; // preset files
    return false;
  });
}

function mockPresetsDir() {
  mockedReaddirSync.mockReturnValue(['tech-minimal.json', 'blank.json'] as any);
  mockedReadFileSync.mockImplementation((path: any) => {
    const p = String(path);
    if (p.endsWith('tech-minimal.json')) return techMinimalPreset;
    if (p.endsWith('blank.json')) return JSON.stringify({ monitor: { domain: 'general' }, sources: [], panels: [], layers: [] });
    return '{}';
  });
}

describe('setup command (non-interactive)', () => {
  it('creates config with defaults when no options given', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.command).toBe('setup');
    expect(output.data.name).toBe('My Monitor');
    expect(output.data.preset).toBe('blank');
    expect(output.data.aiEnabled).toBe(true);
    expect(output.changes).toHaveLength(3);
    expect(output.next_steps).toContain('forge validate');
  });

  it('applies specified preset', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--template', 'tech-minimal', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.preset).toBe('tech-minimal');
    expect(output.data.sources).toBe(3);
    expect(output.data.panels).toBe(2);
  });

  it('sets map configuration', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--center', '-95,38', '--projection', 'globe', '--day-night', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.projection).toBe('globe');
  });

  it('disables AI with --no-ai', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--no-ai', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.data.aiEnabled).toBe(false);
  });

  it('writes API keys to .env.local', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--groq-key', 'gsk_test123', '--format', 'json']);

    const envWriteCall = vi.mocked(writeFileSync).mock.calls.find(
      ([path]) => String(path).endsWith('.env.local')
    );
    expect(envWriteCall).toBeDefined();
    expect(envWriteCall![1]).toContain('GROQ_API_KEY=gsk_test123');
  });

  it('dry-run does not write files', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--dry-run', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.changes[0].description).toContain('Would');
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });

  it('fails when config already exists', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.endsWith('config.json')) return true;
      return false;
    });
    mockPresetsDir();

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('already exists');
  });

  it('warns when AI enabled but no keys provided', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.warnings).toContainEqual(expect.stringContaining('no API keys'));
  });

  it('rejects invalid projection value', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--projection', 'equirectangular', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('Invalid projection');
  });

  it('warns about missing preset gracefully', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.endsWith('config.json')) return false;
      if (p.endsWith('.env.local')) return false;
      if (p.endsWith('nonexistent.json')) return false;
      return false;
    });
    mockedReaddirSync.mockReturnValue([] as any);

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--template', 'nonexistent', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.warnings).toContainEqual(expect.stringContaining('not found'));
  });

  it('rejects invalid center coordinates (NaN)', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--center', 'abc,def', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('must be numbers');
  });

  it('rejects center coordinates out of range', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--center', '200,100', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('out of range');
  });

  it('rejects center with single value', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--center', '123', '--format', 'json']),
    ).rejects.toThrow('exit:1');

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(false);
    expect(output.error).toContain('lng,lat');
  });

  it('dry-run succeeds even when config already exists', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.endsWith('config.json')) return true;
      if (p.endsWith('presets')) return true;
      if (p.endsWith('.json')) return true;
      return false;
    });
    mockPresetsDir();

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--dry-run', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.changes[0].description).toContain('Would');
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });

  it('handles malformed preset JSON gracefully', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.endsWith('config.json')) return false;
      if (p.endsWith('.env.local')) return false;
      if (p.endsWith('presets')) return true;
      if (p.endsWith('broken.json')) return true;
      return false;
    });
    mockedReaddirSync.mockReturnValue([] as any);
    mockedReadFileSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.endsWith('broken.json')) return '{invalid json!!!';
      return '{}';
    });

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--template', 'broken', '--format', 'json']);

    const output = JSON.parse(logOutput[0]);
    expect(output.success).toBe(true);
    expect(output.warnings).toContainEqual(expect.stringContaining('invalid JSON'));
  });

  it('sets chmod 0600 on .env.local', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup', '--non-interactive', '--groq-key', 'gsk_test', '--format', 'json']);

    const chmodCall = vi.mocked(chmodSync).mock.calls.find(
      ([path]) => String(path).endsWith('.env.local')
    );
    expect(chmodCall).toBeDefined();
    expect(chmodCall![1]).toBe(0o600);
  });
});

describe('setup command (interactive)', () => {
  it('happy path through full wizard', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const clack = await import('@clack/prompts');
    const mockedText = vi.mocked(clack.text);
    const mockedSelect = vi.mocked(clack.select);
    const mockedConfirm = vi.mocked(clack.confirm);

    // Step 1: name, description
    mockedText.mockResolvedValueOnce('Test Monitor');
    mockedText.mockResolvedValueOnce('A test dashboard');
    // Step 2: preset
    mockedSelect.mockResolvedValueOnce('tech-minimal');
    // Step 3: projection, center, day/night
    mockedSelect.mockResolvedValueOnce('globe');
    mockedText.mockResolvedValueOnce('126.97, 37.56');
    mockedConfirm.mockResolvedValueOnce(true);
    // Step 4: AI enabled, groq key, openrouter key
    mockedConfirm.mockResolvedValueOnce(true);
    mockedText.mockResolvedValueOnce('gsk_wizard_key');
    mockedText.mockResolvedValueOnce('');

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup']);

    // Config should be written with correct values
    expect(mockedWriteFileSync).toHaveBeenCalled();
    const configCall = mockedWriteFileSync.mock.calls.find(
      ([path]) => String(path).endsWith('config.json')
    );
    expect(configCall).toBeDefined();
    const writtenConfig = JSON.parse(configCall![1] as string);
    expect(writtenConfig.monitor.name).toBe('Test Monitor');
    expect(writtenConfig.monitor.slug).toBe('test-monitor');
    expect(writtenConfig.map.projection).toBe('globe');
    expect(writtenConfig.map.center).toEqual([126.97, 37.56]);
    expect(writtenConfig.map.dayNightOverlay).toBe(true);
    expect(writtenConfig.ai.enabled).toBe(true);
    expect(writtenConfig.sources).toHaveLength(3);
    expect(writtenConfig.panels).toHaveLength(2);

    // .env.local should contain the groq key
    const envCall = mockedWriteFileSync.mock.calls.find(
      ([path]) => String(path).endsWith('.env.local')
    );
    expect(envCall).toBeDefined();
    expect(envCall![1]).toContain('GROQ_API_KEY=gsk_wizard_key');

    // Outro should be called
    expect(clack.outro).toHaveBeenCalled();
  });

  it('cancellation exits gracefully', async () => {
    mockNoExistingConfig();
    mockPresetsDir();

    const clack = await import('@clack/prompts');
    vi.mocked(clack.isCancel).mockReturnValue(true);
    vi.mocked(clack.text).mockResolvedValueOnce(Symbol('cancel') as any);

    const program = createProgram();
    await expect(
      program.parseAsync(['node', 'forge', 'setup']),
    ).rejects.toThrow('exit:0');

    expect(clack.cancel).toHaveBeenCalledWith('Setup cancelled.');
    expect(mockedWriteFileSync).not.toHaveBeenCalled();
  });

  it('merges with existing .env.local', async () => {
    mockedExistsSync.mockImplementation((path: any) => {
      const p = String(path);
      if (p.endsWith('config.json')) return false;
      if (p.endsWith('.env.local')) return true;
      if (p.endsWith('presets')) return true;
      return p.endsWith('tech-minimal.json');
    });
    mockPresetsDir();
    // Return existing .env.local content when reading it
    mockedReadFileSync.mockImplementation((path: any, ...args: any[]) => {
      const p = String(path);
      if (p.endsWith('.env.local')) return 'EXISTING_KEY=existing_value\n';
      if (p.endsWith('tech-minimal.json')) return techMinimalPreset;
      if (p.endsWith('blank.json')) return JSON.stringify({ monitor: { domain: 'general' }, sources: [], panels: [], layers: [] });
      return '{}';
    });

    const clack = await import('@clack/prompts');
    vi.mocked(clack.isCancel).mockReturnValue(false);
    // Step 1
    vi.mocked(clack.text).mockResolvedValueOnce('Merge Test');
    vi.mocked(clack.text).mockResolvedValueOnce('');
    // Step 2
    vi.mocked(clack.select).mockResolvedValueOnce('blank');
    // Step 3
    vi.mocked(clack.select).mockResolvedValueOnce('mercator');
    vi.mocked(clack.text).mockResolvedValueOnce('0, 20');
    vi.mocked(clack.confirm).mockResolvedValueOnce(false);
    // Step 4: AI disabled
    vi.mocked(clack.confirm).mockResolvedValueOnce(false);

    const program = createProgram();
    await program.parseAsync(['node', 'forge', 'setup']);

    const envCall = mockedWriteFileSync.mock.calls.find(
      ([path]) => String(path).endsWith('.env.local')
    );
    expect(envCall).toBeDefined();
    expect(envCall![1]).toContain('EXISTING_KEY=existing_value');
  });
});
