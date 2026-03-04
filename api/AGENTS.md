# api/ — Vercel Edge Functions

## Non-Obvious Rules
- Every handler file must export `const config = { runtime: 'edge' }`
- Use shared utilities from `_shared/` (cors.ts, error.ts) — don't duplicate
- `jsonResponse()` and `errorResponse()` from `_shared/error.ts` handle all response formatting
- These run on Vercel's edge network — no Node.js APIs (no `fs`, no `path`, no `Buffer`)
