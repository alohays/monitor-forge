# monitor-forge — Agent Guide

This file helps any AI coding agent (Claude Code, Gemini CLI, Cursor, Copilot, etc.) work with this project.

## What This Project Is

A CLI-driven template for creating customized real-time intelligence dashboards (inspired by WorldMonitor). The single config file `monitor-forge.config.json` defines everything.

## How to Work With This Project

### 1. Always Use the CLI

Do NOT manually edit `monitor-forge.config.json`. Use forge CLI commands:

```bash
npx tsx forge/bin/forge.ts <command> --format json --non-interactive
```

Or via npm scripts:
```bash
npm run forge -- <command> --format json --non-interactive
```

### 2. Command Pattern

Every command outputs structured JSON:
```json
{
  "success": true|false,
  "command": "command name",
  "data": { ... },
  "changes": [{ "type": "created|modified|deleted", "file": "...", "description": "..." }],
  "warnings": ["..."],
  "error": "only if success=false",
  "next_steps": ["suggested next commands"]
}
```

### 3. Typical Workflow

```bash
# 1. Start from a preset
forge preset list --format json
forge preset apply tech-minimal --format json

# 2. Customize sources
forge source add rss --name "feed-name" --url "https://..." --category news --format json --non-interactive
forge source list --format json

# 3. Customize panels
forge panel add news-feed --name "main" --display-name "News" --position 0 --format json --non-interactive

# 4. Configure AI (optional)
forge ai configure --provider groq --model "llama-3.3-70b-versatile" --api-key-env GROQ_API_KEY --format json --non-interactive

# 5. Validate
forge validate --format json

# 6. Build & preview
forge build --format json
forge dev

# 7. Deploy
forge deploy --format json
```

### 4. Available Commands

| Command | Description |
|---------|-------------|
| `forge init` | Initialize new dashboard |
| `forge preset list/apply` | List or apply presets |
| `forge source add/remove/list` | Manage data sources (rss, rest-api, websocket) |
| `forge layer add/remove/list` | Manage map layers (points, lines, polygons, heatmap, hexagon) |
| `forge panel add/remove/list` | Manage UI panels (ai-brief, news-feed, market-ticker, entity-tracker, instability-index, service-status) |
| `forge ai configure/status` | Configure AI pipeline |
| `forge validate` | Validate configuration |
| `forge env check/generate` | Check/generate environment variables |
| `forge build` | Build for production |
| `forge dev` | Start dev server |
| `forge deploy` | Deploy to Vercel |

### 5. Key Files

| File | Purpose |
|------|---------|
| `monitor-forge.config.json` | Single source of truth for all configuration |
| `forge/src/config/schema.ts` | Zod schema defining valid config structure |
| `presets/*.json` | Preset templates |
| `src/core/` | Frontend engine (map, panels, sources, AI) |
| `api/` | Vercel Edge Functions (news, proxy, AI) |

### 6. Rules

- Always pass `--format json --non-interactive` when running commands
- Always run `forge validate` before `forge build` or `forge deploy`
- Source names must be lowercase alphanumeric with hyphens (e.g., `bbc-world`)
- Colors must be 6-digit hex codes (e.g., `#FF0000`)
- GeoJSON files go in `data/geo/`
- Environment variables are defined in `.env` (check with `forge env check`)
