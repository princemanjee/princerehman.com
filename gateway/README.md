# princerehman-cv-gateway

Cloudflare Worker that brokers requests from the [princerehman.com](https://princerehman.com)
Adaptive CV (the JD-paste UI on `/cv`) to the Anthropic API.

The site never holds the Anthropic API key; the Worker does. The Worker
also enforces a per-IP rate limit and caches identical
`(audience + jdText)` pairs in KV for 24h.

## Deploy

Run these from the `gateway/` directory (a sibling of `src/`, NOT inside
`src/`).

```bash
cd gateway
npm install
```

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

Opens a browser window. One-time per machine.

### 2. Create the KV namespace

```bash
npx wrangler kv:namespace create CV_CACHE
```

The command prints something like:

```
[[kv_namespaces]]
binding = "CV_CACHE"
id = "abc123def456..."
```

Copy the `id` value and paste it into `wrangler.toml` in place of
`REPLACE_WITH_KV_NAMESPACE_ID`. Commit `wrangler.toml` with the real id;
KV namespace ids are not secret.

### 3. Set the Anthropic API key

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

You will be prompted to paste the key. It is stored in Cloudflare's
secret store and is never written to disk in this repo.

To **rotate** the key: re-run the same command and paste the new value.
The old secret is overwritten.

### 4. Deploy

```bash
npx wrangler deploy
```

Wrangler prints the public URL, for example:

```
https://princerehman-cv-gateway.<your-account>.workers.dev
```

### 5. Wire up the site

In the princerehman.com `.env` file (NOT in this `gateway/` directory):

```
PUBLIC_CV_GATEWAY_URL=https://princerehman-cv-gateway.<your-account>.workers.dev
```

Astro picks `PUBLIC_*` env vars up at build time and exposes them via
`import.meta.env.PUBLIC_CV_GATEWAY_URL`.

### 6. Smoke test

```bash
curl -X POST https://princerehman-cv-gateway.<your-account>.workers.dev/tailor \
  -H "Content-Type: application/json" \
  -d '{"audience":"cto","jdText":"test","archiveContext":""}'
```

You should get back JSON with `tailoredSummary`, `tailoredRoles`,
`model`, `cached`, `elapsedMs`. Repeated calls within 24h with the same
audience + JD will return `cached: true`.

## Operate

### View live logs

```bash
npx wrangler tail
```

Streams every request to your terminal. Useful while debugging
rate-limit or CORS issues.

### Adjust the rate limit

Edit `[vars] RATE_LIMIT_PER_HOUR` in `wrangler.toml`, then redeploy:

```bash
npx wrangler deploy
```

The limit is enforced per `CF-Connecting-IP` per rolling hour. Bucket
keys live in KV at `rl:<ip>` with a 1h TTL.

### Adjust the cache TTL

Edit `[vars] CACHE_TTL_SECONDS` in `wrangler.toml`, then redeploy. The
default is 86400 (24h).

To **manually purge a cached response** (e.g. if you regret a tailored
output), delete the matching KV key. Keys are `cache:<sha256>` where
the hash is over `audience + " " + jdText`.

```bash
npx wrangler kv:key list --binding=CV_CACHE
npx wrangler kv:key delete --binding=CV_CACHE "cache:<hash>"
```

## Architecture

```
princerehman.com /cv page
        │
        │  fetch POST /tailor { audience, jdText, archiveContext }
        ▼
[ this Worker ]
   1. CORS (princerehman.com + localhost:4321 only)
   2. Rate limit (KV: rl:<ip>, 10/hr default)
   3. Body validate
   4. Cache lookup (KV: cache:<sha256>)
   5. On miss → POST api.anthropic.com/v1/messages
   6. Parse + validate JSON shape, write to cache
        │
        ▼
   { tailoredSummary, tailoredRoles, model, cached, elapsedMs }
```

## Files

| Path | Role |
|------|------|
| `wrangler.toml` | Worker config (name, vars, KV binding). |
| `src/worker.ts` | Single-file Worker implementing `POST /tailor`. |
| `package.json` | Devtime deps (`wrangler`, `@cloudflare/workers-types`) only. |
| `tsconfig.json` | TypeScript config scoped to Worker types. |
| `README.md` | This file. |

The `ANTHROPIC_API_KEY` never appears in any of these files. It only
ever lives in the Cloudflare secret store.
