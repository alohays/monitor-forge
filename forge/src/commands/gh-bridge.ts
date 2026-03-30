/**
 * EXPERIMENTAL: gh CLI Bridge PoC
 *
 * Proof-of-concept for using `gh` CLI as a data source in monitor-forge.
 * This command validates the execFile-based spawn pattern before the full
 * cli-bridge source type is implemented in v0.6.0.
 *
 * Security: uses child_process.execFile() — NOT exec(). No shell interpolation.
 */

import type { Command } from 'commander';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { formatOutput, success, failure, type OutputFormat } from '../output/format.js';

const execFileAsync = promisify(execFile);

/** SourceItem-compatible shape produced by the bridge transforms. */
export interface SourceItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
  summary?: string;
  category?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
}

/** Raw GitHub issue shape returned by `gh api /repos/{owner}/{repo}/issues`. */
interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  body: string | null;
  labels: Array<{ name: string }>;
  user: { login: string };
  state: string;
}

/** Safe owner/repo pattern — prevents shell-like characters from reaching execFile args. */
const OWNER_REPO_RE = /^[\w.-]+\/[\w.-]+$/;

/**
 * Check whether `gh` is installed and reachable on PATH.
 * Returns null on success, or an error message string on failure.
 */
export async function checkGhAvailable(): Promise<string | null> {
  try {
    await execFileAsync('gh', ['--version']);
    return null;
  } catch {
    return (
      '`gh` CLI is not installed or not on PATH.\n' +
      'Install it from https://cli.github.com/ and run `gh auth login` before using this command.'
    );
  }
}

/**
 * Transform a raw GitHub issue into a SourceItem.
 */
export function transformIssue(issue: GitHubIssue): SourceItem {
  return {
    id: String(issue.number),
    title: issue.title,
    url: issue.html_url,
    publishedAt: issue.created_at,
    summary: issue.body?.slice(0, 280) ?? undefined,
    category: 'github-issues',
    tags: issue.labels.map(l => l.name),
    meta: {
      author: issue.user.login,
      state: issue.state,
      number: issue.number,
    },
  };
}

export function registerGhBridgeCommand(program: Command): void {
  const ghBridge = program
    .command('gh-bridge')
    // EXPERIMENTAL: PoC only — not part of stable API
    .description('[EXPERIMENTAL] gh CLI bridge PoC — validates the cli-bridge pattern for v0.6.0');

  // ── gh-bridge status ──────────────────────────────────────────────────────
  ghBridge
    .command('status')
    .description('Output forge status + gh auth status as JSON')
    .action(async () => {
      const format = (program.opts().format ?? 'json') as OutputFormat;

      const ghError = await checkGhAvailable();
      if (ghError) {
        console.log(formatOutput(failure('gh-bridge status', ghError), format));
        process.exit(1);
        return;
      }

      let ghAuthStatus = 'unknown';
      let ghAuthUser: string | null = null;
      try {
        const { stdout } = await execFileAsync('gh', ['auth', 'status', '--json', 'token,user']);
        const parsed = JSON.parse(stdout) as { token?: string; user?: string };
        ghAuthStatus = parsed.token ? 'authenticated' : 'unauthenticated';
        ghAuthUser = parsed.user ?? null;
      } catch {
        // `gh auth status` exits non-zero when unauthenticated
        ghAuthStatus = 'unauthenticated';
      }

      const data = {
        ghAvailable: true,
        ghAuthStatus,
        ghAuthUser,
        bridgeVersion: 'poc-0.1.0',
        note: 'Full cli-bridge source type planned for v0.6.0',
      };

      console.log(formatOutput(success('gh-bridge status', data), format));
    });

  // ── gh-bridge issues <owner/repo> ─────────────────────────────────────────
  ghBridge
    .command('issues <ownerRepo>')
    .description('Fetch GitHub issues via `gh api` and output as SourceItem[] JSON')
    .action(async (ownerRepo: string) => {
      const format = (program.opts().format ?? 'json') as OutputFormat;

      // Validate input format before passing to execFile
      if (!OWNER_REPO_RE.test(ownerRepo)) {
        console.log(
          formatOutput(
            failure(
              'gh-bridge issues',
              `Invalid owner/repo format: "${ownerRepo}". Expected "owner/repo" (letters, digits, hyphens, dots only).`,
            ),
            format,
          ),
        );
        process.exit(1);
        return;
      }

      const ghError = await checkGhAvailable();
      if (ghError) {
        console.log(formatOutput(failure('gh-bridge issues', ghError), format));
        process.exit(1);
        return;
      }

      let rawIssues: GitHubIssue[];
      try {
        // execFile — NOT exec(). Arguments are passed as an array; no shell involved.
        const { stdout } = await execFileAsync('gh', [
          'api',
          `/repos/${ownerRepo}/issues`,
          '--paginate',
          '--jq',
          '.',
        ]);
        rawIssues = JSON.parse(stdout) as GitHubIssue[];
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(
          formatOutput(
            failure('gh-bridge issues', `gh api call failed: ${msg}`),
            format,
          ),
        );
        process.exit(1);
        return;
      }

      const items: SourceItem[] = rawIssues.map(transformIssue);

      console.log(
        formatOutput(
          success('gh-bridge issues', { ownerRepo, count: items.length, items }),
          format,
        ),
      );
    });
}
