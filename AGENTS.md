# monitor-forge

CLI-driven template for building real-time intelligence dashboards.

## Non-Negotiable Rules

- NEVER manually edit `monitor-forge.config.json` — use `npx tsx forge/bin/forge.ts <cmd>`
- Always append `--format json --non-interactive` for agent use
- Always `forge validate` before `forge build` or `forge deploy`
- Run `npx tsc --noEmit` before pushing — CI will fail otherwise
- All code, comments, commit messages, PRs, and documentation must be in English only

## Directory Guides

Each major directory has its own AGENTS.md with scoped instructions:
- `forge/` — CLI tool, config schema, code generation
- `api/` — Vercel Edge Functions
- `src/` — Frontend engine

## Environment Variables

Check what's needed: `forge env check --format json`
Required keys depend on enabled features (AI provider, cache, deploy).

## CI

`.github/workflows/ci.yml`: typecheck → validate → preset list → build
