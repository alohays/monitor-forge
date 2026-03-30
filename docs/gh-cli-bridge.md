# gh CLI Bridge — Design Document

## Overview

The `gh` CLI bridge is a pattern for using the GitHub CLI (`gh`) as a data source in monitor-forge dashboards. Instead of integrating the GitHub REST API directly, the bridge spawns `gh` as a subprocess, captures its JSON output, and transforms it into the `SourceItem[]` format used by the monitor-forge source system.

This document describes the architecture, security model, proposed data sources, and the recommended scope for the full v0.6.0 cli-bridge implementation.

---

## Architecture

### How the CLI Bridge Pattern Works

```
forge gh-bridge issues owner/repo
       │
       ▼
execFile('gh', ['api', '/repos/owner/repo/issues'])
       │
       ▼ stdout (JSON array)
JSON.parse()
       │
       ▼
transform: GitHubIssue[] → SourceItem[]
       │
       ▼
ForgeOutput<SourceItem[]>  →  console.log (JSON)
```

The bridge:
1. Validates that `gh` is installed and authenticated.
2. Calls `child_process.execFile('gh', [...args])` — never `exec()` or shell interpolation.
3. Parses the stdout as JSON.
4. Applies a typed transform function to produce `SourceItem[]`.
5. Outputs the result as a standard `ForgeOutput` JSON envelope.

### Integration Points with the Source System

In the current PoC the command is standalone. In v0.6.0 it will integrate via a new source type:

```jsonc
// monitor-forge.config.json (future)
{
  "sources": [
    {
      "name": "my-repo-issues",
      "type": "cli-bridge",          // new in v0.6.0
      "cliBridge": {
        "executable": "gh",           // must be in allowlist
        "args": ["api", "/repos/owner/repo/issues"],
        "transform": "github-issues"  // named transform pipeline
      },
      "category": "engineering"
    }
  ]
}
```

The source system will call the bridge at fetch time, identical to how it calls RSS or API sources today.

### Data Flow

```
monitor-forge.config.json
       │  (source definition)
       ▼
CliBridgeSource.fetch()
       │
       ├─ validateExecutable(allowlist)
       ├─ execFile(executable, args)   ← no shell, no interpolation
       ├─ JSON.parse(stdout)
       └─ transform(rawData) → SourceItem[]
```

---

## Security Model

### Executable Allowlist

Only `gh` is permitted in the PoC. In v0.6.0 the allowlist will be configurable but default to `["gh"]`. No arbitrary executables are permitted.

```ts
const ALLOWED_EXECUTABLES = new Set(['gh']);

function validateExecutable(exe: string): void {
  if (!ALLOWED_EXECUTABLES.has(exe)) {
    throw new Error(`Executable "${exe}" is not in the CLI bridge allowlist`);
  }
}
```

### No Shell Execution

`child_process.exec()` passes the command string to `/bin/sh`, enabling shell injection if any argument is user-controlled. The bridge uses `execFile()` exclusively:

```ts
// CORRECT — no shell involved
import { execFile } from 'node:child_process';
execFile('gh', ['api', '/repos/owner/repo/issues'], callback);

// FORBIDDEN — shell injection risk
exec(`gh api /repos/${owner}/${repo}/issues`, callback);
```

### No Shell Interpolation

Arguments are passed as an array, never concatenated into a string. Owner/repo values from config are validated against a safe pattern (`/^[\w.-]+\/[\w.-]+$/`) before being passed to `execFile`.

### API Key Handling

`gh` manages its own authentication via `gh auth login`. The bridge does not read, store, or transmit GitHub tokens. The token lives in `gh`'s secure credential store (`~/.config/gh/hosts.yml` or keychain), never in `monitor-forge.config.json`.

### Config File Access

The bridge reads only `monitor-forge.config.json` for source definitions. It does not read `~/.config/gh/`, `~/.gitconfig`, or any other user config files.

### Sandboxing Considerations

- The bridge subprocess inherits the current user's `$PATH` and environment, which is required for `gh` to find its config.
- In CI, the `GH_TOKEN` environment variable is the recommended auth method — the bridge does not need to handle this specially since `gh` reads it automatically.
- Future: consider spawning `gh` with a restricted environment (`env: { PATH, GH_TOKEN }`) to limit exposure.

---

## Proposed gh Commands for Data Sources

### GitHub Issues

```bash
gh api /repos/{owner}/{repo}/issues
```

**Transform:** `id`, `title`, `body`, `html_url`, `created_at`, `labels[].name`, `user.login` → `SourceItem`

**Use case:** Engineering issue tracker panel, showing open bugs and feature requests in real time.

### Pull Requests

```bash
gh api /repos/{owner}/{repo}/pulls
```

**Transform:** `number`, `title`, `html_url`, `created_at`, `draft`, `user.login`, `head.ref` → `SourceItem`

**Use case:** PR review queue panel; highlights stale or draft PRs.

### CI/CD Status

```bash
gh api /repos/{owner}/{repo}/actions/runs
```

**Transform:** `workflow_runs[].name`, `status`, `conclusion`, `created_at`, `html_url` → `SourceItem`

**Use case:** CI health panel showing recent workflow run outcomes per branch.

### User Notifications

```bash
gh api /notifications
```

**Transform:** `subject.title`, `subject.type`, `repository.full_name`, `updated_at`, `unread` → `SourceItem`

**Use case:** Triage panel aggregating all unread GitHub notifications across repos.

### SourceItem Shape (Target)

```ts
interface SourceItem {
  id: string;
  title: string;
  url: string;
  publishedAt: string;        // ISO 8601
  summary?: string;
  category?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
}
```

---

## v0.6.0 Scope Recommendation

### In-Scope

- New `cli-bridge` source type added to the Zod config schema.
- Configurable executable allowlist in `monitor-forge.config.json` (default: `["gh"]`).
- Generic `execFile`-based runner with timeout and stderr capture.
- Named transform pipelines: `github-issues`, `github-pulls`, `github-actions`, `github-notifications`.
- `forge source add cli-bridge` CLI command with `--executable`, `--args`, `--transform` flags.
- `forge validate` checks: executable in allowlist, args is an array, transform name is registered.
- Tests covering allowlist enforcement, arg array validation, and each transform pipeline.
- Documentation: security model, configuration reference, example config snippets.

### Out-of-Scope for v0.6.0

- Arbitrary user-defined transform functions (code execution risk).
- Shell execution (`exec()`) or glob expansion of arguments.
- Support for executables other than `gh` in the default config (allowlist is user-extensible but defaults to `["gh"]` only).
- OAuth flow or token management — `gh` handles its own auth.
- Windows named-pipe transport — initial release targets macOS/Linux.
- Caching layer for CLI output — deferred to v0.7.0 (requires TTL-aware subprocess scheduling).
- Real-time streaming (`gh` commands are batch, not streaming).

---

## Alternatives Considered

### GitHub REST API Directly

- **Pro:** No external `gh` dependency; works in any environment with a network connection.
- **Con:** Requires auth token management (storing `GITHUB_TOKEN` in env/config), CORS handling, and rate-limit logic that `gh` handles transparently.
- **Decision:** Out of scope for this PoC. The REST API path is always available as a parallel `api` source type; the bridge pattern is specifically for leveraging the local `gh` auth context.

### GitHub GraphQL API

- **Pro:** Single request can fetch issues + PR metadata + CI status; flexible field selection.
- **Con:** Significantly higher query complexity; harder to expose via a simple config DSL; errors are less debuggable.
- **Decision:** Deferred. A `graphql` transform variant could be added in v0.7.0 once the bridge runner is stable.

### Octokit SDK (`@octokit/rest`)

- **Pro:** Fully typed GitHub API client; pagination helpers; automatic retries.
- **Con:** Adds ~150 kB to the bundle; requires token management in config; duplicates functionality already in `gh`.
- **Decision:** Rejected for this use case. monitor-forge targets zero-config agent workflows where `gh` auth is already set up. Octokit is a better fit for a dedicated server-side integration, not a CLI bridge.

---

## PoC Implementation Notes

The PoC (`forge gh-bridge`) is registered as an **experimental** command in `forge/bin/forge.ts`. It is not exported from any index file and has no config schema integration. Its purpose is to validate:

1. The `execFile` spawn pattern works reliably across environments.
2. The GitHub Issues JSON → `SourceItem[]` transform produces the expected shape.
3. Error handling (missing `gh`, auth failure, network error) is user-friendly.

The PoC output is always JSON (`ForgeOutput` envelope) regardless of `--format` flag, making it easy to pipe into other tools or inspect in CI.
