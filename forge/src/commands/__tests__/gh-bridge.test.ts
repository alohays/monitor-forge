import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerGhBridgeCommand, transformIssue, checkGhAvailable } from '../gh-bridge.js';

// Mock child_process so tests never require a real gh installation
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

// Also mock node:util so promisify wraps our mocked execFile
vi.mock('node:util', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:util')>();
  return {
    ...original,
    promisify: (fn: unknown) => {
      // Return an async wrapper that delegates to the (mocked) fn
      return (...args: unknown[]) =>
        new Promise((resolve, reject) => {
          (fn as (...a: unknown[]) => void)(...args, (err: unknown, result: unknown) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
    },
  };
});

import { execFile } from 'node:child_process';
const mockedExecFile = vi.mocked(execFile);

/** Helper: make execFile callback with stdout. */
function mockExecFileSuccess(stdout: string) {
  mockedExecFile.mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
        null,
        { stdout, stderr: '' },
      );
      return {} as ReturnType<typeof execFile>;
    },
  );
}

/** Helper: make execFile callback with an error. */
function mockExecFileError(message: string) {
  mockedExecFile.mockImplementation(
    (_cmd: unknown, _args: unknown, callback: unknown) => {
      (callback as (err: Error) => void)(new Error(message));
      return {} as ReturnType<typeof execFile>;
    },
  );
}

function createProgram(): Command {
  const program = new Command();
  program
    .option('--format <format>', 'Output format', 'json')
    .option('--non-interactive')
    .option('--dry-run');
  registerGhBridgeCommand(program);
  return program;
}

class ExitError extends Error {
  constructor(public code: number) {
    super(`exit ${code}`);
  }
}

async function runCommand(args: string[]): Promise<string> {
  const outputs: string[] = [];
  const origLog = console.log;
  const origExit = process.exit;
  console.log = (msg: string) => outputs.push(msg);
  process.exit = ((code?: number) => {
    throw new ExitError(code ?? 0);
  }) as never;

  try {
    const program = createProgram();
    await program.parseAsync(['node', 'forge', ...args]);
  } catch (err) {
    if (!(err instanceof ExitError)) throw err;
  } finally {
    console.log = origLog;
    process.exit = origExit;
  }

  return outputs[0] ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Test 1: gh-bridge status output format ────────────────────────────────

describe('forge gh-bridge status', () => {
  it('returns valid JSON with expected fields when gh is available', async () => {
    // First call: gh --version (availability check)
    mockedExecFile
      .mockImplementationOnce(
        (_cmd: unknown, _args: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null,
            { stdout: 'gh version 2.40.0 (2024-01-01)', stderr: '' },
          );
          return {} as ReturnType<typeof execFile>;
        },
      )
      // Second call: gh auth status --json token,user
      .mockImplementationOnce(
        (_cmd: unknown, _args: unknown, callback: unknown) => {
          (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
            null,
            { stdout: JSON.stringify({ token: 'ghs_abc123', user: 'octocat' }), stderr: '' },
          );
          return {} as ReturnType<typeof execFile>;
        },
      );

    const output = await runCommand(['gh-bridge', 'status']);
    const result = JSON.parse(output);

    expect(result.success).toBe(true);
    expect(result.command).toBe('gh-bridge status');
    expect(result.data).toMatchObject({
      ghAvailable: true,
      ghAuthStatus: 'authenticated',
      ghAuthUser: 'octocat',
      bridgeVersion: expect.stringContaining('poc'),
    });
  });
});

// ── Test 2: gh-bridge issues transforms to expected SourceItem shape ──────

describe('forge gh-bridge issues', () => {
  const sampleIssues = [
    {
      number: 42,
      title: 'Fix the bug',
      html_url: 'https://github.com/owner/repo/issues/42',
      created_at: '2024-03-01T10:00:00Z',
      body: 'There is a bug that needs fixing.',
      labels: [{ name: 'bug' }, { name: 'high-priority' }],
      user: { login: 'alice' },
      state: 'open',
    },
  ];

  it('transforms GitHub issue format to SourceItem-compatible structure', async () => {
    // First call: gh --version
    mockedExecFile.mockImplementationOnce(
      (_cmd: unknown, _args: unknown, callback: unknown) => {
        (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: 'gh version 2.40.0', stderr: '' },
        );
        return {} as ReturnType<typeof execFile>;
      },
    );
    // Second call: gh api /repos/owner/repo/issues
    mockedExecFile.mockImplementationOnce(
      (_cmd: unknown, _args: unknown, callback: unknown) => {
        (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: JSON.stringify(sampleIssues), stderr: '' },
        );
        return {} as ReturnType<typeof execFile>;
      },
    );

    const output = await runCommand(['gh-bridge', 'issues', 'owner/repo']);
    const result = JSON.parse(output);

    expect(result.success).toBe(true);
    expect(result.data.ownerRepo).toBe('owner/repo');
    expect(result.data.count).toBe(1);

    const item = result.data.items[0];
    expect(item).toMatchObject({
      id: '42',
      title: 'Fix the bug',
      url: 'https://github.com/owner/repo/issues/42',
      publishedAt: '2024-03-01T10:00:00Z',
      summary: 'There is a bug that needs fixing.',
      category: 'github-issues',
      tags: ['bug', 'high-priority'],
      meta: {
        author: 'alice',
        state: 'open',
        number: 42,
      },
    });
  });

  it('rejects invalid owner/repo format without calling gh', async () => {
    const output = await runCommand(['gh-bridge', 'issues', 'not valid/repo!!']);
    const result = JSON.parse(output);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid owner/repo format');
    // execFile should not have been called at all
    expect(mockedExecFile).not.toHaveBeenCalled();
  });
});

// ── Test 3: error handling when gh is not installed ───────────────────────

describe('gh-bridge error handling', () => {
  it('returns a helpful error message when gh is not installed', async () => {
    // execFile fails for gh --version (gh not found)
    mockExecFileError('spawn gh ENOENT');

    const output = await runCommand(['gh-bridge', 'status']);
    const result = JSON.parse(output);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not installed');
    expect(result.error).toContain('cli.github.com');
  });

  it('returns error when gh api call fails', async () => {
    // gh --version succeeds
    mockedExecFile.mockImplementationOnce(
      (_cmd: unknown, _args: unknown, callback: unknown) => {
        (callback as (err: null, result: { stdout: string; stderr: string }) => void)(
          null,
          { stdout: 'gh version 2.40.0', stderr: '' },
        );
        return {} as ReturnType<typeof execFile>;
      },
    );
    // gh api call fails (e.g. auth error)
    mockedExecFile.mockImplementationOnce(
      (_cmd: unknown, _args: unknown, callback: unknown) => {
        (callback as (err: Error) => void)(new Error('HTTP 401: Bad credentials'));
        return {} as ReturnType<typeof execFile>;
      },
    );

    const output = await runCommand(['gh-bridge', 'issues', 'owner/repo']);
    const result = JSON.parse(output);

    expect(result.success).toBe(false);
    expect(result.error).toContain('gh api call failed');
    expect(result.error).toContain('401');
  });
});

// ── Unit tests for transformIssue ─────────────────────────────────────────

describe('transformIssue', () => {
  it('maps all fields correctly including optional body truncation', () => {
    const longBody = 'x'.repeat(500);
    const issue = {
      number: 7,
      title: 'Test issue',
      html_url: 'https://github.com/a/b/issues/7',
      created_at: '2024-01-15T08:30:00Z',
      body: longBody,
      labels: [{ name: 'enhancement' }],
      user: { login: 'bob' },
      state: 'closed',
    };

    const item = transformIssue(issue);

    expect(item.id).toBe('7');
    expect(item.title).toBe('Test issue');
    expect(item.url).toBe('https://github.com/a/b/issues/7');
    expect(item.publishedAt).toBe('2024-01-15T08:30:00Z');
    // Body should be truncated to 280 chars
    expect(item.summary).toHaveLength(280);
    expect(item.tags).toEqual(['enhancement']);
    expect(item.meta?.state).toBe('closed');
  });

  it('handles null body gracefully', () => {
    const issue = {
      number: 1,
      title: 'No body issue',
      html_url: 'https://github.com/a/b/issues/1',
      created_at: '2024-01-01T00:00:00Z',
      body: null,
      labels: [],
      user: { login: 'alice' },
      state: 'open',
    };

    const item = transformIssue(issue);
    expect(item.summary).toBeUndefined();
  });
});
