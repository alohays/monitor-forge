# Adding Data Sources

## Trigger
User wants to add RSS feeds, API sources, or WebSocket connections to their monitor.

## Recommended: Add from Curated Library

The fastest way to add sources is from the built-in library of 244 curated RSS feeds (20 categories) and 20 public API templates.

```bash
# Browse available library feeds by category
npx tsx forge/bin/forge.ts source list-library --category tech --format json

# Add a feed from the curated library (idempotent with --upsert)
npx tsx forge/bin/forge.ts source add rss --from-library <feed-id> --upsert

# Browse available API templates
npx tsx forge/bin/forge.ts source list-templates --format json

# Add a source from an API template
npx tsx forge/bin/forge.ts source add rest-api --from-template <template-id> --upsert
```

Library feeds include pre-configured URLs, categories, tiers, and propaganda risk metadata. Use `list-library` and `list-templates` to discover available IDs.

For sources not in the library, use the manual add commands below.

## Source Types

| Type | Use Case | Example |
|------|----------|---------|
| `rss` | News feeds, blogs, podcasts | BBC, TechCrunch, arXiv |
| `rest-api` | JSON APIs | GDELT, financial data APIs |
| `websocket` | Real-time streams | Crypto tickers, live feeds |

## Adding an RSS Source

```bash
npx tsx forge/bin/forge.ts source add rss \
  --name "<lowercase-hyphenated>" \
  --url "<feed-url>" \
  --category <category> \
  --tier <1-4> \
  --interval <seconds> \
  --format json --non-interactive
```

**Tier guide**: 1 = primary/critical, 2 = important, 3 = supplementary, 4 = background

## Adding a REST API Source

```bash
npx tsx forge/bin/forge.ts source add rest-api \
  --name "<name>" \
  --url "<api-endpoint>" \
  --category <category> \
  --format json --non-interactive
```

## Adding a WebSocket Source

```bash
npx tsx forge/bin/forge.ts source add websocket \
  --name "<name>" \
  --url "wss://<endpoint>" \
  --category <category> \
  --format json --non-interactive
```

## Finding RSS Feeds

Tips for discovering feeds:
- Most news sites have `/rss`, `/feed`, or `/rss.xml` endpoints
- Use `https://hnrss.org/` for Hacker News filters
- Use `https://rsshub.app/` for sites without native RSS
- arXiv: `https://rss.arxiv.org/rss/<category>` (e.g., cs.AI, cs.RO)
- Reddit: append `.rss` to any subreddit URL

## Managing Sources

```bash
# List all sources
npx tsx forge/bin/forge.ts source list --format json

# Remove a source
npx tsx forge/bin/forge.ts source remove <name> --format json
```

## Validation

After adding sources, always validate:
```bash
npx tsx forge/bin/forge.ts validate --format json
```
