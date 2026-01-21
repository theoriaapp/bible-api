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
Set `PUBLIC_BASE_URL` (optional) to force the OpenAPI `servers` URL in production.

## Error codes
All error responses use the shape:
`{ "error": { "code": "SOME_CODE", "message": "...", "hint": "optional" } }`

Common codes:
- `UNAUTHORIZED` - Missing or invalid `api-key` header
- `BIBLE_NOT_FOUND` - Unknown bible id (only `NKJV` is supported)
- `INVALID_CHAPTER_ID` - Bad chapter format (expected `BOOK.CHAPTER`, e.g. `GEN.1`)
- `INVALID_PASSAGE_ID` - Bad passage format (expected `BOOK.CHAPTER.START-BOOK.CHAPTER.END`)
- `INVALID_PASSAGE_RANGE` - Passage end must be after the start
- `PASSAGE_NOT_FOUND` - Passage does not exist in storage
- `VOTD_NOT_SET` - Verse of the day not yet generated

Passage examples:
- Same chapter: `GEN.1.1-GEN.1.5`
- Shorthand end verse: `JHN.1.12-15`
- Multi-chapter (same book): `JHN.1.12-2.5`
- Multi-book: `JHN.21.25-ACT.1.3`

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

## Seed initial VOTD (production)
Use this once to set a starting Verse of the Day in the production KV namespace:

```
npx wrangler kv key put current_votd \
'{"data":{"id":"GEN.1.1","text":"In the beginning God created the heavens and the earth.","bibleId":"NKJV","bookId":"GEN","chapter":"1"},"meta":{}}' \
--binding BIBLE_KV \
--remote
```
