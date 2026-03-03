# Configuring AI Pipeline

## Trigger
User wants to set up AI analysis, configure LLM providers, or customize AI prompts.

## Supported Providers

| Provider | Models | API Key Env | Notes |
|----------|--------|-------------|-------|
| Groq | llama-3.3-70b-versatile, mixtral-8x7b-32768 | `GROQ_API_KEY` | Fast inference, free tier |
| OpenRouter | anthropic/claude-sonnet-4, openai/gpt-4o, etc. | `OPENROUTER_API_KEY` | Multi-model access |

## Setup

### Step 1: Configure Provider

```bash
# Primary provider (e.g., Groq for speed)
npx tsx forge/bin/forge.ts ai configure \
  --provider groq \
  --model "llama-3.3-70b-versatile" \
  --api-key-env GROQ_API_KEY \
  --format json --non-interactive

# Fallback provider (e.g., OpenRouter for quality)
npx tsx forge/bin/forge.ts ai configure \
  --provider openrouter \
  --model "anthropic/claude-sonnet-4" \
  --api-key-env OPENROUTER_API_KEY \
  --format json --non-interactive
```

### Step 2: Set API Key

Add to `.env`:
```
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
```

Or generate the template:
```bash
npx tsx forge/bin/forge.ts env generate --format json
```

### Step 3: Verify

```bash
npx tsx forge/bin/forge.ts ai status --format json
npx tsx forge/bin/forge.ts env check --format json
```

## AI Analysis Features

The AI pipeline can perform:
- **Summarization**: Generate intelligence briefs from collected news
- **Entity Extraction**: Identify key people, organizations, locations
- **Sentiment Analysis**: Detect positive/negative/neutral tone
- **Focal Point Detection**: Identify the most important developing stories

These are configured in the preset or can be toggled via the config.

## Custom Prompts

For domain-specific analysis, set a custom prompt in the config. Examples:

- **Tech**: "Focus on AI breakthroughs, funding rounds, product launches, and regulatory developments."
- **Finance**: "Focus on market-moving events, central bank decisions, earnings surprises, and geopolitical risks."
- **Geopolitics**: "Focus on geopolitical tensions, military movements, diplomatic developments, and escalation signals."

## Fallback Chain

The AI system uses a fallback chain: if the primary provider fails, it tries the next one. The default chain is `["groq", "openrouter"]`. The order matters — put the fastest/cheapest provider first.

## Tips

- Groq is very fast and has a generous free tier — great for primary
- OpenRouter provides access to Claude, GPT-4o, and others — great as fallback
- Get a free Groq API key at https://console.groq.com/
- Get an OpenRouter API key at https://openrouter.ai/
