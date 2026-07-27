# Ingest worker

Cloudflare Worker that polls Google News for each tracked journalist every 10
minutes, extracts structured transfer claims with Claude Haiku, and serves them
at `/claims` for the app's Incoming inbox. The journalist roster is shared with
the app via `src/db/seed-journalists.json`.

## One-time deploy

```bash
cd worker
npx wrangler login                          # opens browser — free Cloudflare account
npx wrangler kv namespace create INGEST_KV  # paste the printed id into wrangler.toml
npx wrangler secret put ANTHROPIC_API_KEY   # paste your key from console.anthropic.com
npx wrangler deploy
```

The deploy prints the worker URL (e.g. `https://journalist-rater-ingest.<you>.workers.dev`).
Put it in the app's `.env.local` as `EXPO_PUBLIC_INGEST_URL=<url>` (and in EAS
env for store builds), then rebuild/redeploy the app.

## Endpoints

- `GET /claims` — current claim drafts (72 h window), newest first
- `GET /run` — trigger an ingest cycle manually (useful right after deploy)
