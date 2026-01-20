# bible-api
Build a Bible API hosted on Cloudflare Workers

## Setup
1. Install deps: `npm install`
2. Copy env template: `cp env.example .env`
3. Fill `.env` with your R2 credentials and bucket name.
4. Seed R2: `npm run seed`
5. Set `API_KEY` in `wrangler.toml` (or run `wrangler dev --var API_KEY=...`)
6. Deploy: `npm run deploy`

## OpenAPI docs (Hono OpenAPI)
Public OpenAPI JSON:
- `http://localhost:8787/openapi.json`
Swagger UI:
- `http://localhost:8787/docs`

## Environment variables
- `R2_ENDPOINT` - `https://<accountid>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `API_KEY`

## Secrets
Do not commit real secrets. For production, store `API_KEY` with:

```
wrangler secret put API_KEY
```
