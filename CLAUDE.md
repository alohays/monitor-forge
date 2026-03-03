# monitor-forge

Create your own real-time intelligence dashboard. A meta-level template for building customized worldmonitor-style dashboards via CLI.

## Architecture

```
monitor-forge/
├── forge/              # CLI tool (TypeScript)
│   ├── bin/forge.ts    # Entry point
│   └── src/
│       ├── commands/   # init, source, layer, panel, ai, validate, build, dev, deploy, env, preset
│       ├── config/     # Zod schema + JSON config loader/writer
│       ├── generators/ # Manifest, Vercel config, env generators
│       └── output/     # JSON/table output formatter
├── src/                # Frontend (Vite + TypeScript)
│   ├── core/
│   │   ├── map/        # MapLibre GL + deck.gl engine
│   │   ├── panels/     # Panel system (6 built-in types)
│   │   ├── sources/    # Data source system (RSS, API, WebSocket)
│   │   └── ai/        # AI pipeline (Groq, OpenRouter)
│   └── App.ts          # Main application shell
├── api/                # Vercel Edge Functions
│   ├── news/v1/        # RSS aggregation
│   ├── proxy/v1/       # CORS proxy
│   └── ai/v1/          # LLM analysis relay
├── presets/            # 7 preset templates (JSON)
└── monitor-forge.config.json  # Single source of truth
```

## Single Config

All customization happens through `monitor-forge.config.json`. The forge CLI reads and writes this file. Never edit it manually — use forge commands.

## CLI Quick Reference

All commands support `--format json` and `--non-interactive` for agent use.

```bash
# Initialize
forge init --name "My Monitor" --domain technology --format json --non-interactive

# Presets
forge preset list --format json
forge preset apply tech-minimal --format json

# Sources (RSS, REST API, WebSocket)
forge source add rss --name "bbc-world" --url "https://feeds.bbci.co.uk/news/world/rss.xml" --category news --format json --non-interactive
forge source list --format json
forge source remove bbc-world --format json

# Layers (points, lines, polygons, heatmap, hexagon)
forge layer add points --name "events" --display-name "Events" --data-path "data/geo/events.geojson" --color "#FF0000" --category events --format json --non-interactive
forge layer list --format json
forge layer remove events --format json

# Panels (ai-brief, news-feed, market-ticker, entity-tracker, instability-index, service-status)
forge panel add news-feed --name "main-feed" --display-name "News" --position 0 --format json --non-interactive
forge panel list --format json
forge panel remove main-feed --format json

# AI Configuration
forge ai configure --provider groq --model "llama-3.3-70b-versatile" --api-key-env GROQ_API_KEY --format json --non-interactive
forge ai status --format json

# Validation & Environment
forge validate --format json
forge env check --format json
forge env generate --format json

# Build & Deploy
forge build --format json
forge dev
forge deploy --format json
```

## JSON Output Contract

Every command returns:
```json
{
  "success": true,
  "command": "source add",
  "data": { ... },
  "changes": [{ "type": "modified", "file": "...", "description": "..." }],
  "warnings": [],
  "next_steps": ["forge validate", "forge dev"]
}
```

## Common Workflows

### "I want a monitor for [topic]"

1. `forge preset apply <closest-preset> --format json`
2. Add/remove sources to match the topic
3. Configure AI with appropriate custom prompt
4. `forge validate --format json`
5. `forge dev` to preview
6. `forge deploy --format json` when ready

### Available Presets

| Preset | Domain | Sources | Panels |
|--------|--------|---------|--------|
| blank | general | 0 | 0 |
| tech-minimal | technology | 3 | 2 |
| tech-full | technology | 8 | 4 |
| finance-minimal | finance | 3 | 2 |
| finance-full | finance | 6 | 4 |
| geopolitics-minimal | geopolitics | 3 | 2 |
| geopolitics-full | geopolitics | 8 | 5 |

### Adding a Custom RSS Feed

```bash
forge source add rss \
  --name "my-feed" \
  --url "https://example.com/rss.xml" \
  --category news \
  --tier 2 \
  --interval 600 \
  --format json --non-interactive
```

### Adding a GeoJSON Layer

1. Place your `.geojson` file in `data/geo/`
2. ```bash
   forge layer add points \
     --name "my-layer" \
     --display-name "My Layer" \
     --data-path "data/geo/my-data.geojson" \
     --color "#00FF00" \
     --category data \
     --format json --non-interactive
   ```

## Environment Variables

| Variable | Required | Used By |
|----------|----------|---------|
| `GROQ_API_KEY` | If AI enabled with Groq | AI pipeline |
| `OPENROUTER_API_KEY` | If AI enabled with OpenRouter | AI pipeline |
| `UPSTASH_REDIS_URL` | If using Redis cache | Backend cache |
| `UPSTASH_REDIS_TOKEN` | If using Redis cache | Backend cache |
| `VERCEL_TOKEN` | For deployment | forge deploy |

Run `forge env check --format json` to see which are needed and which are set.

## Tech Stack

- **Build**: Vite 6 + TypeScript 5
- **Map**: MapLibre GL + deck.gl
- **Visualization**: D3
- **RSS**: fast-xml-parser
- **Security**: DOMPurify
- **CLI**: Commander + Zod
- **AI**: Groq, OpenRouter (via Edge Functions)
- **Deploy**: Vercel

## Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| initializing-monitor | New dashboard setup | Walk through init + preset + customize |
| adding-data-sources | RSS/API/WS feeds | Find and add data sources |
| adding-map-layers | Map visualization | Create GeoJSON and add layers |
| configuring-ai-pipeline | AI/LLM setup | Configure providers and analysis |
| deploying-to-vercel | Deployment | Pre-flight checks + deploy |

## Important Notes

- Config file is `monitor-forge.config.json` (JSON, not TypeScript)
- Always use `--format json --non-interactive` when operating as an agent
- Run `forge validate` before `forge build` or `forge deploy`
- The `forge build` command generates manifests in `src/generated/` before Vite build
- All panel types: ai-brief, news-feed, market-ticker, entity-tracker, instability-index, service-status, custom
- All source types: rss, rest-api, websocket
- All layer types: points, lines, polygons, heatmap, hexagon
