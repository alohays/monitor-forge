# Adding Panels

Panels are the UI components of a dashboard. Each panel has a type, display name, and position.

## Built-in Panel Types

| Type | Description |
|------|-------------|
| `news-feed` | Scrollable feed of news items from sources |
| `ai-brief` | AI-generated intelligence summary |
| `entity-tracker` | Track key entities across sources |
| `market-ticker` | Financial market data display |
| `instability-index` | Geopolitical instability scoring |
| `service-status` | Health status of configured sources |
| `custom` | User-defined panel (requires scaffold) |

## Add a Built-in Panel

```bash
# Basic panel
forge panel add news-feed --name tech-news --display-name "Tech News"

# With source reference and config
forge panel add news-feed --name tech-news --display-name "Tech News" \
  --source my-rss-feed \
  --config-json '{"categories": ["tech"], "maxItems": 30}'

# Idempotent: update if exists
forge panel add news-feed --name tech-news --display-name "Tech News" --upsert
```

## Create a Custom Panel

```bash
# Scaffolds src/custom-panels/MyWidget.ts and registers in config
forge panel create my-widget --display-name "My Widget"

# Scaffold only (no config registration)
forge panel create my-widget --no-register
```

## Panel Position

Position determines rendering order (0-based). Specify with `--position`:

```bash
forge panel add ai-brief --name my-brief --display-name "Brief" --position 2
```

## List and Remove

```bash
forge panel list
forge panel remove tech-news
```

## Common Configurations

### News Feed
```json
{"categories": ["tech-news", "research"], "maxItems": 50}
```

### AI Brief
```json
{"refreshInterval": 600}
```

### Entity Tracker
```json
{"entities": ["OpenAI", "Google", "Anthropic"], "maxEntities": 20}
```

## After Adding Panels

1. Add panels to a view: `forge view add main --display-name "Main" --panels "panel1,panel2"`
2. Validate: `forge validate`
3. Preview: `forge dev`
