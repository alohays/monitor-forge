<div align="center">

# monitor-forge

**Build real-time intelligence dashboards with AI agents.**

The first agent-native dashboard framework — designed for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and other AI coding agents to build customized dashboards through conversation.

<img src=".github/assets/hero-banner.jpg" alt="monitor-forge: config-driven personalized dashboards" width="800" />

[![CI](https://github.com/alohays/monitor-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/alohays/monitor-forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![GitHub release](https://img.shields.io/github/v/release/alohays/monitor-forge)](https://github.com/alohays/monitor-forge/releases)

<p>
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Quick_Start-blue?style=for-the-badge" alt="Quick Start"></a>
  <a href="#-available-presets"><img src="https://img.shields.io/badge/Presets-green?style=for-the-badge" alt="Presets"></a>
  <a href="#%EF%B8%8F-cli-commands"><img src="https://img.shields.io/badge/CLI_Reference-orange?style=for-the-badge" alt="CLI Reference"></a>
  <a href="#-one-click-deploy"><img src="https://img.shields.io/badge/Deploy-purple?style=for-the-badge" alt="Deploy"></a>
</p>

[Quick Start](#-quick-start) · [Why monitor-forge?](#-why-monitor-forge) · [Presets](#-available-presets) · [CLI Reference](#%EF%B8%8F-cli-commands) · [Contributing](./CONTRIBUTING.md)

</div>

---

> "I want a dashboard tracking Korean robotics news with AI analysis."
>
> That's it. Tell an AI agent, and monitor-forge builds it.

## 🔍 Why monitor-forge?

[WorldMonitor](https://github.com/koala73/worldmonitor) proved the demand — 25K+ stars and 4,100+ forks. But every fork requires manual customization: editing source code, rebuilding, and redeploying.

**monitor-forge** inverts this: describe what you want, and an AI agent builds it using a structured CLI.

| | WorldMonitor | Manual Fork | **monitor-forge** |
|---|---|---|---|
| Setup time | N/A (single purpose) | Hours to days | **Minutes** |
| Customization | Edit source code | Edit source code | **CLI commands** |
| AI agent support | None | None | **Native** (AGENTS.md, Skills) |
| Domain presets | 1 | 1 per fork | **15 included** |
| AI analysis | None | DIY | **Built-in** (Groq/OpenRouter) |
| Adding sources | Edit code | Edit code | **`forge source add`** |
| Deploy | Manual | Manual | **One-click** (Vercel) |

## 🚀 Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/monitor-forge.git my-monitor
cd my-monitor
npm install    # auto-generates manifests
npm run dev    # dashboard at http://localhost:5173
```

Ships with a **tech-minimal** preset (Hacker News, TechCrunch, Ars Technica) out of the box. No API keys required.

<details>
<summary><strong>📝 Manual Customization</strong></summary>

```bash
# Browse and apply a preset
npm run forge -- preset list
npm run forge -- preset apply finance-full

# Add custom sources
npm run forge -- source add rss \
  --name "reuters" \
  --url "https://feeds.reuters.com/reuters/topNews" \
  --category world-news

# Enable AI analysis (optional — free tier available)
npm run forge -- ai configure \
  --provider groq \
  --model "llama-3.3-70b-versatile" \
  --api-key-env GROQ_API_KEY

# Validate and deploy
npm run forge -- validate
npm run deploy
```

</details>

## 🤖 Using with AI Agents

Open the project in [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (or any AGENTS.md-compatible agent) and say:

> "I want to create a geopolitics monitor focused on Southeast Asia"

The agent reads CLAUDE.md/AGENTS.md, uses the forge CLI, and builds your dashboard. See [CLAUDE.md](./CLAUDE.md) for Claude Code integration or [AGENTS.md](./AGENTS.md) for other agents.

> [!NOTE]
> Every `forge` command supports `--format json --non-interactive` for AI agent consumption.

## ✨ Key Features

<table>
<tr>
<td width="33%" valign="top">

### 🛠️ CLI-First Config
All customization via `forge` commands. `--format json` for seamless AI agent integration. One config file defines your entire dashboard.

</td>
<td width="33%" valign="top">

### 📋 15 Domain Presets
Pre-built configs across 8 domains: tech, finance, geopolitics, climate, cyber, health, korea. From blank canvas to full setup.

</td>
<td width="33%" valign="top">

### 🗺️ Real-Time Map
MapLibre GL + deck.gl with 5 layer types: points, lines, polygons, heatmap, and hexagon grid.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🤖 AI Analysis
Summarization, entity extraction, and sentiment analysis via Groq (Llama 3.3) or OpenRouter (Claude, GPT-4o).

</td>
<td width="33%" valign="top">

### 📊 6 Panel Types
News feed, AI brief, market ticker, entity tracker, instability index, and service status — all config-driven.

</td>
<td width="33%" valign="top">

### 🚀 One-Click Deploy
Vercel Edge Functions with security headers, CSP, and proxy domain allowlist. RSS, API, and WebSocket sources.

</td>
</tr>
</table>

## 📦 Available Presets

> [!TIP]
> Start with a `*-minimal` preset to get running fast, then graduate to `*-full` when you need more sources and panels. Use `blank` for a completely custom build.

| Preset | Domain | Sources | Panels | Description |
|--------|--------|:-------:|:------:|-------------|
| `blank` | general | 0 | 0 | Empty canvas — start from scratch |
| `tech-minimal` | technology | 3 | 2 | HN, TechCrunch, Ars Technica |
| `tech-full` | technology | 8 | 4 | + Verge, Wired, MIT Tech Review, arXiv, GitHub |
| `finance-minimal` | finance | 3 | 2 | Reuters, CNBC, CoinDesk |
| `finance-full` | finance | 6 | 4 | + FT, Bloomberg, Fed RSS |
| `geopolitics-minimal` | geopolitics | 3 | 2 | BBC, Reuters, Al Jazeera |
| `geopolitics-full` | geopolitics | 8 | 5 | + Guardian, AP, Foreign Affairs, GDELT |
| `climate-minimal` | climate | 3 | 2 | Carbon Brief, Phys.org Earth, Guardian Environment |
| `climate-full` | climate | 6 | 4 | + ReliefWeb, NASA Earth Observatory, NOAA Climate |
| `cyber-minimal` | cybersecurity | 3 | 2 | Krebs on Security, The Hacker News, Bleeping Computer |
| `cyber-full` | cybersecurity | 7 | 4 | + CISA Alerts, Dark Reading, Schneier, Ars Security |
| `health-minimal` | health | 3 | 2 | WHO News, STAT News, NIH News |
| `health-full` | health | 7 | 4 | + Lancet, CDC Newsroom, bioRxiv, Global Health Now |
| `korea-minimal` | korea | 3 | 2 | Yonhap English, Korea Herald, BBC Asia |
| `korea-full` | korea | 7 | 4 | + NK News, Hankyoreh, Reuters Asia, Korea Times |

<p align="center">
  <img src=".github/assets/concept-diagram.jpg" alt="monitor-forge concept: CLI command drives data sources through the forge into a real-time dashboard" width="800" />
</p>

## 📡 Workflow & Data Flow

<details open>
<summary><strong>Workflow & Data Flow diagrams</strong></summary>

### Workflow

```mermaid
flowchart LR
    A(["📥 Clone &<br/>Install"])
    B(["📋 Choose<br/>Preset"])
    C(["🔗 Add Sources<br/>& Panels"])
    D(["🤖 Configure AI<br/>(optional)"])
    E{{"✅ Validate"}}
    F{{"📦 Build"}}
    G(["🚀 Deploy"])

    A ==> B ==> C ==> D
    D -.-> E
    C ==> E
    E ==> F ==> G

    classDef setup fill:#1565C0,stroke:#0D47A1,stroke-width:2px,color:#fff
    classDef config fill:#00838F,stroke:#006064,stroke-width:2px,color:#fff
    classDef ai fill:#EF6C00,stroke:#E65100,stroke-width:2px,color:#fff
    classDef check fill:#2E7D32,stroke:#1B5E20,stroke-width:2px,color:#fff
    classDef deploy fill:#AD1457,stroke:#880E4F,stroke-width:2px,color:#fff

    class A,B setup
    class C config
    class D ai
    class E,F check
    class G deploy
```

### Data Flow

```mermaid
flowchart TD
    subgraph Sources["📡 Data Sources"]
        RSS(["RSS Feeds"])
        API(["REST APIs"])
        WS(["WebSockets"])
    end

    subgraph Edge["☁️ Vercel Edge"]
        NE["news/v1<br/>RSS Aggregation"]
        PE["proxy/v1<br/>CORS Proxy"]
        AE["ai/v1<br/>LLM Endpoint"]
    end

    subgraph AI["🤖 AI Fallback Chain"]
        GQ{{"Groq<br/>Llama 3.3"}}
        OR{{"OpenRouter<br/>Claude / GPT-4o"}}
        GQ -.->|fallback| OR
    end

    subgraph Panels["📊 Dashboard Panels"]
        NF["News Feed"]
        AB["AI Brief"]
        MT["Market Ticker"]
        ET["Entity Tracker"]
    end

    MAP(["🗺️ MapEngine<br/>5 Layer Types"])

    RSS ==> NE ==> NF
    API ==> PE ==> MT
    WS ==> ET
    NE ==> AE ==> AI
    AI ==> AB
    Sources -.-> MAP

    classDef source fill:#00838F,stroke:#006064,stroke-width:2px,color:#fff
    classDef edge fill:#7B1FA2,stroke:#4A148C,stroke-width:2px,color:#fff
    classDef ai fill:#EF6C00,stroke:#E65100,stroke-width:2px,color:#fff
    classDef panel fill:#D84315,stroke:#BF360C,stroke-width:2px,color:#fff
    classDef map fill:#1565C0,stroke:#0D47A1,stroke-width:2px,color:#fff

    class RSS,API,WS source
    class NE,PE,AE edge
    class GQ,OR ai
    class NF,AB,MT,ET panel
    class MAP map
```

</details>

## 🏗️ Architecture

<details open>
<summary><strong>System architecture diagram</strong></summary>

```mermaid
flowchart LR
    subgraph CLI["🛠️ forge CLI"]
        CMD(["forge commands"])
        CFG[("config.json")]
        CMD ==> CFG
    end

    subgraph BUILD["⚙️ Build Pipeline"]
        GEN{{"Manifest Generator"}}
        SM["source-manifest"]
        LM["layer-manifest"]
        PM["panel-manifest"]
        CR["config-resolved"]
        GEN ==> SM
        GEN ==> LM
        GEN ==> PM
        GEN ==> CR
    end

    subgraph APP["🖥️ Frontend"]
        MAP(["MapEngine<br/>MapLibre + deck.gl"])
        PNL(["PanelManager<br/>6 panel types"])
        SRC(["SourceManager<br/>RSS / API / WS"])
        AIM(["AIManager<br/>Groq / OpenRouter"])
        SRC ==> PNL
        SRC ==> AIM
        AIM ==> PNL
    end

    subgraph EDGE["☁️ Vercel Edge Functions"]
        NEWS["news/v1"]
        PROXY["proxy/v1"]
        AIEP["ai/v1"]
    end

    CFG ==> GEN
    SM & LM & PM & CR ==> APP
    SRC <--> EDGE

    classDef cli fill:#1565C0,stroke:#0D47A1,stroke-width:2px,color:#fff
    classDef build fill:#2E7D32,stroke:#1B5E20,stroke-width:2px,color:#fff
    classDef frontend fill:#D84315,stroke:#BF360C,stroke-width:2px,color:#fff
    classDef edge fill:#7B1FA2,stroke:#4A148C,stroke-width:2px,color:#fff

    class CMD,CFG cli
    class GEN,SM,LM,PM,CR build
    class MAP,PNL,SRC,AIM frontend
    class NEWS,PROXY,AIEP edge
```

</details>

## ⌨️ CLI Commands

| Command | Description |
|---------|-------------|
| `forge init` | Initialize a new dashboard |
| `forge setup` | Interactive setup wizard |
| `forge status` | Check project state and configuration |
| `forge preset list/apply` | Browse and apply presets |
| `forge source add/remove/list` | Manage RSS, API, WebSocket sources |
| `forge layer add/remove/list` | Manage map layers (points, lines, polygons, heatmap, hexagon) |
| `forge panel add/remove/list` | Manage UI panels |
| `forge view add/remove/list` | Manage dashboard views |
| `forge ai configure/status` | Set up AI analysis pipeline |
| `forge theme set/status` | Manage visual theme and color palette |
| `forge validate` | Validate configuration |
| `forge env check/generate` | Manage environment variables |
| `forge build` | Build for production |
| `forge dev` | Start development server |
| `forge deploy` | Deploy to Vercel |

## 🔧 Tech Stack

- **Frontend**: Vite 6, TypeScript 5, MapLibre GL, deck.gl, D3
- **Backend**: Vercel Edge Functions
- **AI**: Groq (Llama 3.3), OpenRouter (Claude, GPT-4o, etc.)
- **CLI**: Commander, Zod, tsx
- **Security**: DOMPurify, CSP headers, proxy domain allowlist

## 📁 Project Structure

```
monitor-forge/
├── 🛠️ forge/              # CLI tool (Commander + Zod)
├── 🖥️ src/                # Frontend application
│   ├── core/              # Map, panels, sources, AI engines
│   └── styles/            # CSS + themes
├── ☁️ api/                # Vercel Edge Functions
├── 📋 presets/            # 15 preset templates (8 domains)
├── 🗺️ data/geo/           # GeoJSON data files
├── 🤖 .claude/skills/     # 5 Claude Code Skills
├── 📝 .skills/            # 2 workflow guides
├── ⚙️ monitor-forge.config.json
├── 📄 CLAUDE.md           # Claude Code agent guide
└── 📄 AGENTS.md           # Cross-agent compatibility guide
```

---

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📜 License

[MIT](./LICENSE) — Copyright (c) 2026 Yunsung Lee
