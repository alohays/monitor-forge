# Deploying to Vercel

## Trigger
User wants to deploy their dashboard, go live, or publish their monitor.

## Pre-flight Checklist

Run these checks before deploying:

```bash
# 1. Validate config
npx tsx forge/bin/forge.ts validate --format json

# 2. Check environment variables
npx tsx forge/bin/forge.ts env check --format json

# 3. Build
npx tsx forge/bin/forge.ts build --format json
```

## Deploy

### Option A: Via forge CLI
```bash
npx tsx forge/bin/forge.ts deploy --format json
npx tsx forge/bin/forge.ts deploy --prod --format json  # production
```

### Option B: Via Vercel CLI directly
```bash
npx vercel         # preview deployment
npx vercel --prod  # production deployment
```

### Option C: Via Git integration
Push to GitHub and connect to Vercel dashboard for automatic deployments.

## Required Environment Variables

Set these in Vercel Dashboard > Project Settings > Environment Variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `GROQ_API_KEY` | If AI enabled | Groq LLM provider |
| `OPENROUTER_API_KEY` | If AI fallback | OpenRouter LLM provider |
| `UPSTASH_REDIS_URL` | If Redis cache | Server-side caching |
| `UPSTASH_REDIS_TOKEN` | If Redis cache | Server-side caching |

## Vercel Project Setup

The `forge build` command auto-generates `vercel.json` with:
- Security headers (X-Frame-Options, CSP, etc.)
- API route caching (5 min for news, 10 min for proxy)
- Correct output directory

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Build fails | Run `forge validate` first, check for missing files |
| API 500 errors | Check environment variables in Vercel dashboard |
| CORS errors | Verify `backend.corsProxy.enabled` is true in config |
| RSS feeds empty | Some feeds block Vercel IPs — try different sources |
| AI not working | Verify API keys are set in Vercel env vars |

## Custom Domain

After deployment:
1. Go to Vercel Dashboard > Project > Settings > Domains
2. Add your custom domain
3. Follow DNS configuration instructions

## Tips

- Always do a preview deployment (`forge deploy`) before production (`forge deploy --prod`)
- Use `forge env generate` to create `.env.example` for documentation
- The Vercel free tier supports Edge Functions and is sufficient for most monitors
