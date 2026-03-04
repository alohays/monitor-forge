# monitor-forge

Create your own real-time intelligence dashboard in minutes. A meta-level template repository for building customized [WorldMonitor](https://github.com/koala73/worldmonitor)-style dashboards.

## What is this?

WorldMonitor has 25K+ stars and 4,100+ forks — but every fork is manually customized. **monitor-forge** solves this by providing a CLI-driven template where AI agents (Claude Code, Gemini CLI, etc.) can build a customized dashboard through a few conversations.

### Key Features

- **CLI-first**: All customization via `forge` commands with JSON output
- **Single config**: One `monitor-forge.config.json` defines everything
- **AI agent-friendly**: CLAUDE.md, AGENTS.md, and 5 Claude Code Skills included
- **7 presets**: tech, finance, geopolitics (minimal & full) + blank
- **Real-time map**: MapLibre GL + deck.gl with 5 layer types
- **6 panel types**: News feed, AI brief, market ticker, entity tracker, instability index, service status
- **3 data source types**: RSS, REST API, WebSocket
- **AI analysis**: Summarization, entity extraction, sentiment analysis via Groq/OpenRouter
- **One-click deploy**: Vercel Edge Functions

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/monitor-forge.git my-monitor
cd my-monitor
npm install    # auto-generates manifests
npm run dev    # dashboard at http://localhost:5173
```

Ships with a **tech-minimal** preset (Hacker News, TechCrunch, Ars Technica) out of the box. No API keys required.

### Customize

```bash
# Switch to a different preset
npm run forge -- preset list
npm run forge -- preset apply finance-minimal

# Add sources
npm run forge -- source add rss --name "my-feed" --url "https://example.com/rss.xml" --category news

# Add panels
npm run forge -- panel add news-feed --name "main" --display-name "News" --position 0

# Enable AI analysis (optional — requires a free API key)
npm run forge -- ai configure --provider groq --model "llama-3.3-70b-versatile" --api-key-env GROQ_API_KEY
```

### Deploy

```bash
npm run forge -- validate
npm run deploy
```

## Using with AI Agents

This repo is designed to be operated by AI coding agents. Start a conversation with:

> "I want to create a monitor for Korean robotics news"

The agent will use the forge CLI to set up everything. See [CLAUDE.md](./CLAUDE.md) for Claude Code integration or [AGENTS.md](./AGENTS.md) for other agents.

## Available Presets

| Preset | Domain | Sources | Panels | Description |
|--------|--------|---------|--------|-------------|
| `blank` | general | 0 | 0 | Empty canvas |
| `tech-minimal` | technology | 3 | 2 | HN, TechCrunch, Ars Technica |
| `tech-full` | technology | 8 | 4 | + Verge, Wired, MIT Tech Review, arXiv, GitHub |
| `finance-minimal` | finance | 3 | 2 | Reuters, CNBC, CoinDesk |
| `finance-full` | finance | 6 | 4 | + FT, Bloomberg, Fed RSS |
| `geopolitics-minimal` | geopolitics | 3 | 2 | BBC, Reuters, Al Jazeera |
| `geopolitics-full` | geopolitics | 8 | 5 | + Guardian, AP, Foreign Affairs, GDELT |

## CLI Commands

| Command | Description |
|---------|-------------|
| `forge init` | Initialize a new dashboard |
| `forge preset list/apply` | Browse and apply presets |
| `forge source add/remove/list` | Manage RSS, API, WebSocket sources |
| `forge layer add/remove/list` | Manage map layers (points, lines, polygons, heatmap, hexagon) |
| `forge panel add/remove/list` | Manage UI panels |
| `forge ai configure/status` | Set up AI analysis pipeline |
| `forge validate` | Validate configuration |
| `forge env check/generate` | Manage environment variables |
| `forge build` | Build for production |
| `forge dev` | Start development server |
| `forge deploy` | Deploy to Vercel |

## Tech Stack

- **Frontend**: Vite 6, TypeScript 5, MapLibre GL, deck.gl, D3
- **Backend**: Vercel Edge Functions
- **AI**: Groq (Llama 3.3), OpenRouter (Claude, GPT-4o, etc.)
- **CLI**: Commander, Zod, tsx
- **Security**: DOMPurify, CSP headers

## Project Structure

```
monitor-forge/
├── forge/              # CLI tool
├── src/                # Frontend application
│   ├── core/           # Map, panels, sources, AI engines
│   └── styles/         # CSS
├── api/                # Vercel Edge Functions
├── presets/            # 7 preset templates
├── data/geo/           # GeoJSON data files
├── .claude/skills/     # 5 Claude Code Skills
├── CLAUDE.md           # Claude Code agent guide
├── AGENTS.md           # Cross-agent compatibility guide
└── monitor-forge.config.json  # Your dashboard config
```

## License

MIT
