# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] - 2026-03-04

### Added

- CLI-driven dashboard configuration with 11 forge commands
- 7 presets: tech, finance, geopolitics (minimal & full) + blank canvas
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
