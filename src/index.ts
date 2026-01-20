import { Hono } from "hono";
import type { Context } from "hono";
import { auth } from "./middleware/auth.js";
import { bookIdToChapters } from "./mappings.js";
import { scheduled } from "./scheduled.js";

type Env = {
  BIBLE_BUCKET: R2Bucket;
  BIBLE_KV: KVNamespace;
  API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Bible API (NKJV)",
    version: "1.0.0",
    description: "Minimal OpenAPI spec for the Bible API."
  },
  servers: [{ url: "/v1" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: "apiKey",
        in: "header",
        name: "api-key"
      }
    }
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/bibles": { get: { summary: "List Bibles", responses: { "200": { description: "OK" } } } },
    "/bibles/{bibleId}/books": {
      get: {
        summary: "List Books",
        parameters: [
          { name: "bibleId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } }
      }
    },
    "/bibles/{bibleId}/chapters/{chapterId}": {
      get: {
        summary: "Get Chapter",
        parameters: [
          { name: "bibleId", in: "path", required: true, schema: { type: "string" } },
          { name: "chapterId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" }, "400": { description: "Bad request" }, "404": { description: "Not found" } }
      }
    },
    "/votd": { get: { summary: "Verse of the Day", responses: { "200": { description: "OK" }, "404": { description: "Not found" } } } },
    "/bibles/{bibleId}/passages/{passageId}": {
      get: {
        summary: "Get Passage",
        parameters: [
          { name: "bibleId", in: "path", required: true, schema: { type: "string" } },
          { name: "passageId", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: { "200": { description: "OK" }, "400": { description: "Bad request" }, "404": { description: "Not found" } }
      }
    }
  }
};

app.get("/openapi.json", (c) => c.json(openApiSpec));

app.get("/openapi", (c) => {
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bible API OpenAPI</title>
  </head>
  <body>
    <h1>Bible API OpenAPI</h1>
    <p>Download the OpenAPI JSON here:</p>
    <p><a href="/openapi.json">/openapi.json</a></p>
    <p>Base URL for API calls: <code>/v1</code></p>
  </body>
</html>`);
});

app.use("/v1/*", auth);

app.get("/v1/openapi.json", (c) => c.json(openApiSpec));

app.get("/v1/bibles", (c) => {
  return c.json({
    data: [
      {
        id: "NKJV",
        name: "New King James Version",
        abbreviation: "NKJV"
      }
    ],
    meta: {}
  });
});

app.get("/v1/bibles/:bibleId/books", async (c) => {
  const bibleId = c.req.param("bibleId");
  if (bibleId !== "NKJV") {
    return c.json({ error: "Bible not found" }, 404);
  }

  return fetchR2Json(c, "NKJV/books.json");
});

app.get("/v1/bibles/:bibleId/chapters/:chapterId", async (c) => {
  const bibleId = c.req.param("bibleId");
  if (bibleId !== "NKJV") {
    return c.json({ error: "Bible not found" }, 404);
  }

  const chapterId = c.req.param("chapterId");
  const parsed = parseChapterId(chapterId);
  if (!parsed) {
    return c.json({ error: "Invalid chapter id" }, 400);
  }

  const key = `NKJV/${parsed.bookId}/${parsed.chapter}.json`;
  return fetchR2Json(c, key);
});

app.get("/v1/votd", async (c) => {
  const value = await c.env.BIBLE_KV.get("current_votd", "json");
  if (!value) {
    return c.json({ error: "Verse of the day not set" }, 404);
  }

  return c.json(value);
});

app.get("/v1/bibles/:bibleId/passages/:passageId", async (c) => {
  const bibleId = c.req.param("bibleId");
  if (bibleId !== "NKJV") {
    return c.json({ error: "Bible not found" }, 404);
  }

  const passageId = c.req.param("passageId");
  const [startRef, endRef] = passageId.split("-");
  const start = parseVerseId(startRef);
  const end = endRef ? parseVerseId(endRef) : start;

  if (!start || !end) {
    return c.json({ error: "Invalid passage id" }, 400);
  }

  if (start.bookId !== end.bookId || start.chapter !== end.chapter) {
    return c.json({ error: "Passage must be within one chapter" }, 400);
  }

  const key = `NKJV/${start.bookId}/${start.chapter}.json`;
  const obj = await c.env.BIBLE_BUCKET.get(key);
  if (!obj) {
    return c.json({ error: "Passage not found" }, 404);
  }

  const chapterData = (await obj.json()) as {
    data?: { content?: Array<{ id: string; text: string }> };
  };

  const content = (chapterData?.data?.content ?? []).filter((verse) => {
    const verseNum = Number(verse.id.split(".").pop());
    return verseNum >= start.verse && verseNum <= end.verse;
  });

  return c.json({
    data: {
      id: passageId,
      bibleId: "NKJV",
      content
    },
    meta: {}
  });
});

function parseChapterId(chapterId: string) {
  const [bookId, chapterStr] = chapterId.split(".");
  const chapter = Number(chapterStr);
  if (!bookId || Number.isNaN(chapter)) return null;
  const maxChapters = bookIdToChapters.get(bookId);
  if (!maxChapters || chapter < 1 || chapter > maxChapters) return null;
  return { bookId, chapter: String(chapter) };
}

function parseVerseId(verseId: string | undefined) {
  if (!verseId) return null;
  const parts = verseId.split(".");
  if (parts.length !== 3) return null;
  const [bookId, chapterStr, verseStr] = parts;
  const chapter = Number(chapterStr);
  const verse = Number(verseStr);
  if (!bookId || Number.isNaN(chapter) || Number.isNaN(verse)) return null;
  const maxChapters = bookIdToChapters.get(bookId);
  if (!maxChapters || chapter < 1 || chapter > maxChapters) return null;
  if (verse < 1) return null;
  return { bookId, chapter: String(chapter), verse };
}

async function fetchR2Json(
  c: Context<{ Bindings: Env }>,
  key: string
): Promise<Response> {
  const obj = await c.env.BIBLE_BUCKET.get(key);
  if (!obj) {
    return c.json({ error: "Not found" }, 404);
  }
  return c.body(obj.body, 200, {
    "content-type": obj.httpMetadata?.contentType ?? "application/json"
  });
}

export default app;
export { scheduled };
