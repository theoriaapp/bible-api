# bible-api
Build a Bible API hosted on Cloudflare Workers

![Tests](https://github.com/theoriaapp/bible-api/actions/workflows/tests.yml/badge.svg)

## Supported bibles
- `NKJV` — New King James Version.
- `OSB` — Orthodox Study Bible. LXX-based Old Testament (Greek versification: Psalms 1–151 with Psalm 151, 2 Chronicles 37 = Prayer of Manasseh, Joel has 4 chapters) plus the deuterocanonical books (Tobit, Judith, 1–3 Maccabees, Wisdom of Solomon, Sirach, Baruch, Letter of Jeremiah, Susanna, Bel and the Dragon, 1 Esdras; `testament: "DC"` in the books manifest). The New Testament text is the NKJV. Includes study notes (`features: ["notes"]`).

Note: verse ids are **not** interchangeable across bibles — the OSB Old Testament follows Septuagint numbering, so e.g. `PSA.23.1` refers to different text in NKJV vs OSB.

## Study notes (OSB)
- `GET /v1/bibles/OSB/chapters/GEN.1/notes` — notes anchored within a chapter, in document order. Each note: `{ id, type, verseId, text, sequence }` where `type` is `intro` | `inline` | `sidebar` | `footnote` | `unclear`. Sidebar notes are section headings/article titles; inline notes are study-article paragraphs.
- `GET /v1/bibles/OSB/books/GEN/intro` — book introduction (Author, Date, Major Theme, Background).
- `?include-notes=true` on chapter and verse endpoints embeds the relevant notes in the response.
- Requesting notes for a bible without the `notes` feature returns `404 NOTES_NOT_AVAILABLE`.

## Offline download
`GET /v1/bibles/:bibleId/download` returns the complete bible (text plus study notes where available) as one JSON bundle (~6.5 MB raw, ~2 MB over the wire) for client apps that want offline storage. The bundle mirrors the online API shapes: `data.chapters` keyed by chapter id, `data.notes.chapters` / `data.notes.intros` for study notes, and `data.revision` (content hash). To check for updates, repeat the request with `If-None-Match: <previous ETag>` — a `304` means the local copy is current.

Bundles are pre-built at seed time (`{BIBLE}/bundle.json` in R2). To rebuild just the bundle: `npm run seed -- --bundle-only` (NKJV) or `npm run seed:osb -- --bundle-only` (OSB).

## Caching
Content endpoints send `Cache-Control: private, max-age=86400` and an `ETag` (with `If-None-Match`/304 support). `private` is deliberate: responses are gated by the `api-key` header, and shared caches key on the URL — this includes the Workers dashboard "Cache" runtime setting, which should stay **disabled** (it would serve cached responses without checking auth, and caches responses lacking Cache-Control for ~2h by default).

## Setup
1. Install deps: `npm install`
2. Copy env template: `cp env.example .env`
3. Fill `.env` with your R2 credentials and bucket name.
4. Seed R2 with NKJV: `npm run seed`
5. Seed R2 with OSB: `npm run seed:osb` (reads `~/Downloads/osb.db` by default; override with `--db /path/to/osb.db` or `OSB_DB_PATH`; use `--dry-run --out DIR` to write JSON locally instead of uploading)
6. Set `API_KEY` in `wrangler.toml` (or run `wrangler dev --var API_KEY=...`)
7. Deploy: `npm run deploy`

## OpenAPI docs (Hono OpenAPI)
Public OpenAPI JSON:
- `http://localhost:8787/openapi.json`
Swagger UI:
- `http://localhost:8787/docs`
Set `PUBLIC_BASE_URL` (optional) to force the OpenAPI `servers` URL in production.

## Testing
Run local tests (mocked data + auth):

```
npm run test:local
```

Run against prod (real endpoint):

```
API_KEY=your_key npm run test:prod
```

Optional flags:
- `BASE_URL=https://...`
- `PROD_BASE_URL=https://...`

CI notes:
- GitHub Actions runs `test:local` on every PR/push to `main`.
- Prod tests run on `main` only and require repo secrets:
  - `API_KEY` (your prod API key)
  - `BASE_URL` (e.g. `https://bible-api.theoria-app.workers.dev`)

## Error codes
All error responses use the shape:
`{ "error": { "code": "SOME_CODE", "message": "...", "hint": "optional" } }`

Common codes:
- `UNAUTHORIZED` - Missing or invalid `api-key` header
- `BIBLE_NOT_FOUND` - Unknown bible id (supported: `NKJV`, `OSB`)
- `NOTES_NOT_AVAILABLE` - Study notes requested for a bible without the `notes` feature
- `INVALID_BOOK_ID` - Unknown book code for the requested bible
- `DOWNLOAD_NOT_AVAILABLE` - No offline bundle published for the requested bible
- `INVALID_CHAPTER_ID` - Bad chapter format (expected `BOOK.CHAPTER`, e.g. `GEN.1`)
- `INVALID_PASSAGE_ID` - Bad passage format (expected `BOOK.CHAPTER.START-BOOK.CHAPTER.END`)
- `INVALID_PASSAGE_RANGE` - Passage end must be after the start
- `PASSAGE_NOT_FOUND` - Passage does not exist in storage
- `INVALID_SEARCH_QUERY` - Search query cannot be parsed
- `VOTD_NOT_SET` - Verse of the day not yet generated

Passage examples:
- Same chapter: `GEN.1.1-GEN.1.5`
- Shorthand end verse: `JHN.1.12-15`
- Multi-chapter (same book): `JHN.1.12-2.5`
- Multi-book: `JHN.21.25-ACT.1.3`

Search endpoint:
- `GET /v1/search?q=JHN6:12-15`
- `GET /v1/search?q=JHN6-12`
- `GET /v1/search?q=John 6:12-15 NKJV`
- `GET /v1/search?q=JHN.21.25-ACT.1.3`
- `GET /v1/search?q=JHN6:12-15,GEN1:1-3`

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
