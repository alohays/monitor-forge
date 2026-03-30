# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.5.0] - 2026-03-31

### Added

- 244 curated RSS feeds library across 20 categories with propaganda risk metadata
- 20 public API source templates (USGS, NASA, GDELT, CoinGecko, etc.)
- `forge source add --from-library` and `--from-template` commands for batch source imports
- `forge source list-library` and `list-templates` commands for browsing available sources
- `forge apply` declarative config patching command (merge-by-name, delete markers, dry-run)
- `npx create-monitor-forge` scaffolding package with interactive and non-interactive modes
- 4 new presets: commodity-minimal, commodity-full, happy-minimal, happy-full (19 total)
- Experimental `forge gh-bridge` command for GitHub CLI data source integration
- Polling scheduler with stagger, jitter, and concurrency control for SourceManager
- CI per-preset validation in GitHub Actions pipeline
- Feed verification script (`scripts/verify-feeds.ts`) for RSS feed liveness checks
- seenIds memory cap (10,000 per source) preventing unbounded memory growth

### Changed

- SourceManager.startAll() now delegates to polling scheduler instead of firing all fetches simultaneously
- SourceManager.fetchAll() now respects concurrency limit (max 5 concurrent fetches)
- RSS handler gracefully degrades on partial feed failures instead of returning 500

### Removed

- `preset apply --merge` flag (was dead code, never implemented; use `forge apply` instead)

## [0.1.0] - 2026-03-04

### Added

- CLI-driven dashboard configuration with 11 forge commands
- 7 initial presets: tech, finance, geopolitics (minimal & full) + blank canvas
- 6 panel types: news-feed, ai-brief, market-ticker, entity-tracker, instability-index, service-status
- 5 map layer types: points, lines, polygons, heatmap, hexagon
- 3 data source types: RSS, REST API, WebSocket
- AI analysis pipeline with Groq and OpenRouter providers
- Vercel Edge Functions backend (news, proxy, AI endpoints)
- 5 Claude Code Skills for agent-driven workflows
- AGENTS.md cross-agent compatibility guide
- CI pipeline (typecheck, test, validate, build)

### Security

- Proxy domain allowlist enforcement
- XSS sanitization with DOMPurify in all panels
- Content Security Policy headers on deployments
- Rate limiting on API endpoints
