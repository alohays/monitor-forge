# Adding Data Sources

## Trigger
User wants to add RSS feeds, API sources, or WebSocket connections to their monitor.

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
