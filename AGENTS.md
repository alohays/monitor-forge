# monitor-forge

CLI-driven template for building real-time intelligence dashboards.

## Non-Negotiable Rules

- Prefer CLI commands for config changes: `npx tsx forge/bin/forge.ts <cmd>`
- Direct editing of `monitor-forge.config.json` is acceptable when CLI commands are insufficient (e.g., complex multi-field updates, bulk operations, or fields not exposed by CLI)
- Non-TTY environments (agents, CI) auto-default to `--format json --non-interactive` — no need to pass these flags manually
- Always `forge validate` before `forge build` or `forge deploy`
- Run `forge build --skip-vite` then `npx tsc --noEmit` before pushing — typecheck requires generated manifests
- All code, comments, commit messages, PRs, and documentation must be in English only

## Quick Start for Agents

```bash
# Check project state (single command replaces 6+ separate queries)
npx tsx forge/bin/forge.ts status

# Re-initialize with a preset (--force overwrites existing config)
npx tsx forge/bin/forge.ts init --template tech-full --force

# Full interactive setup (--force overwrites)
npx tsx forge/bin/forge.ts setup --template tech-minimal --name "My Dashboard" --force

# Idempotent add commands (--upsert updates if exists, creates if not)
npx tsx forge/bin/forge.ts source add rss --name my-feed --url https://example.com/rss --category news --upsert
npx tsx forge/bin/forge.ts panel add news-feed --name my-panel --display-name "My Panel" --upsert
npx tsx forge/bin/forge.ts view add main --display-name "Main" --panels "my-panel" --default --upsert

# Add source from curated library (244 feeds across 20 categories)
npx tsx forge/bin/forge.ts source add rss --from-library hn-front-page --upsert

# Add source from public API template (20 templates: USGS, NASA, GDELT, etc.)
npx tsx forge/bin/forge.ts source add rest-api --from-template usgs-earthquakes --upsert

# Browse available library feeds by category
npx tsx forge/bin/forge.ts source list-library --category tech

# Apply a declarative config patch (merge-by-name, dry-run first)
npx tsx forge/bin/forge.ts apply patch.json --dry-run
```

## Error Recovery

CLI errors include structured recovery suggestions in JSON output:
- `errorCode`: machine-readable error type
- `retryable`: whether the operation can be retried
- `recovery.suggestions`: actionable next steps
- `validationErrors`: Zod field paths and messages for validation failures

## Directory Guides

Each major directory has its own AGENTS.md with scoped instructions:
- `forge/` — CLI tool, config schema, code generation
- `api/` — Vercel Edge Functions
- `src/` — Frontend engine

## Workflow Guides (SKILL.md)

Step-by-step guides for common agent workflows:
- `.skills/managing-views.md` — Creating, updating, and organizing dashboard views
- `.skills/adding-panels.md` — Adding panels with correct configuration

## Environment Variables

Check what's needed: `forge env check` (auto-detects format based on TTY)
Required keys depend on enabled features (AI provider, cache, deploy).

## CI

`.github/workflows/ci.yml`: typecheck → validate → preset list → build
