import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, openAPISpecs } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { auth } from "./middleware/auth.js";
import { bookIdToChapters } from "./mappings.js";
import { scheduled } from "./scheduled.js";

type Env = {
  BIBLE_BUCKET: R2Bucket;
  BIBLE_KV: KVNamespace;
  API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

const bibleIdParam = z.object({ bibleId: z.string() });
const chapterParam = z.object({ bibleId: z.string(), chapterId: z.string() });
const passageParam = z.object({ bibleId: z.string(), passageId: z.string() });
const unknownResponse = z.unknown();

app.use("/v1/*", auth);

app.get(
  "/v1/bibles",
  describeRoute({
    description: "List available bibles",
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: resolver(unknownResponse) } }
      }
    }
  }),
  (c) => {
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
  }
);

app.get(
  "/v1/bibles/:bibleId/books",
  describeRoute({
    description: "List books for a bible",
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: resolver(unknownResponse) } }
      },
      404: { description: "Not found" }
    }
  }),
  validator("param", bibleIdParam),
  async (c) => {
  const { bibleId } = c.req.valid("param");
  if (bibleId !== "NKJV") {
    return c.json({ error: "Bible not found" }, 404);
  }

  return fetchR2Json(c, "NKJV/books.json");
  }
);

app.get(
  "/v1/bibles/:bibleId/chapters/:chapterId",
  describeRoute({
    description: "Fetch a chapter by id",
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: resolver(unknownResponse) } }
      },
      400: { description: "Bad request" },
      404: { description: "Not found" }
    }
  }),
  validator("param", chapterParam),
  async (c) => {
  const { bibleId, chapterId } = c.req.valid("param");
  if (bibleId !== "NKJV") {
    return c.json({ error: "Bible not found" }, 404);
  }

  const parsed = parseChapterId(chapterId);
  if (!parsed) {
    return c.json({ error: "Invalid chapter id" }, 400);
  }

  const key = `NKJV/${parsed.bookId}/${parsed.chapter}.json`;
  return fetchR2Json(c, key);
  }
);

app.get(
  "/v1/votd",
  describeRoute({
    description: "Get the verse of the day",
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: resolver(unknownResponse) } }
      },
      404: { description: "Not found" }
    }
  }),
  async (c) => {
  const value = await c.env.BIBLE_KV.get("current_votd", "json");
  if (!value) {
    return c.json({ error: "Verse of the day not set" }, 404);
  }

  return c.json(value);
  }
);

app.get(
  "/v1/bibles/:bibleId/passages/:passageId",
  describeRoute({
    description: "Fetch a passage within a chapter",
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: resolver(unknownResponse) } }
      },
      400: { description: "Bad request" },
      404: { description: "Not found" }
    }
  }),
  validator("param", passageParam),
  async (c) => {
  const { bibleId, passageId } = c.req.valid("param");
  if (bibleId !== "NKJV") {
    return c.json({ error: "Bible not found" }, 404);
  }

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
  }
);

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

app.get(
  "/openapi.json",
  openAPISpecs(app as unknown as Hono, {
    documentation: {
      info: {
        title: "Bible API",
        version: "1.0.0",
        description: "Serverless Bible API endpoints."
      },
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
      servers: [
        { url: "http://localhost:8787", description: "Local" },
        { url: "https://<your-worker>.workers.dev", description: "Production" }
      ]
    }
  })
);

app.get("/docs", (c) => {
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bible API Docs</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
    />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui"
      });
    </script>
  </body>
</html>`);
});

export default app;
export { scheduled };
