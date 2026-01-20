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

const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    hint: z.string().optional()
  })
});

const errorExamples = {
  unauthorized: {
    value: {
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid api-key header.",
        hint: "Provide the api-key header with your API key."
      }
    }
  },
  bibleNotFound: {
    value: { error: { code: "BIBLE_NOT_FOUND", message: "Bible not found." } }
  },
  invalidChapterId: {
    value: {
      error: {
        code: "INVALID_CHAPTER_ID",
        message: "Invalid chapter id. Expected format BOOK.CHAPTER (e.g., GEN.1)."
      }
    }
  },
  invalidPassageId: {
    value: {
      error: {
        code: "INVALID_PASSAGE_ID",
        message:
          "Invalid passage id. Expected format BOOK.CHAPTER.START-BOOK.CHAPTER.END (e.g., GEN.1.1-GEN.1.5)."
      }
    }
  },
  passageCrossesChapters: {
    value: {
      error: {
        code: "PASSAGE_CROSSES_CHAPTERS",
        message: "Passage must be within one chapter."
      }
    }
  },
  passageNotFound: {
    value: {
      error: { code: "PASSAGE_NOT_FOUND", message: "Passage not found." }
    }
  },
  votdNotSet: {
    value: { error: { code: "VOTD_NOT_SET", message: "Verse of the day not set." } }
  },
  notFound: {
    value: { error: { code: "NOT_FOUND", message: "Resource not found." } }
  }
};

const bibleListResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      abbreviation: z.string()
    })
  ),
  meta: z.record(z.unknown()).optional()
});

const booksResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      abbreviation: z.string(),
      chapters: z.number()
    })
  ),
  meta: z.record(z.unknown()).optional()
});

const chapterResponse = z.object({
  data: z.object({
    id: z.string(),
    bibleId: z.string(),
    content: z.array(
      z.object({
        id: z.string(),
        text: z.string()
      })
    )
  }),
  meta: z.record(z.unknown()).optional()
});

const passageResponse = z.object({
  data: z.object({
    id: z.string(),
    bibleId: z.string(),
    content: z.array(
      z.object({
        id: z.string(),
        text: z.string()
      })
    )
  }),
  meta: z.record(z.unknown()).optional()
});

const votdResponse = z.object({
  data: z.object({
    id: z.string(),
    text: z.string(),
    bibleId: z.string(),
    bookId: z.string(),
    chapter: z.string()
  }),
  meta: z.record(z.unknown()).optional()
});

app.use("/v1/*", auth);

app.get(
  "/v1/bibles",
  describeRoute({
    summary: "List available bibles",
    description: "List available bibles",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: resolver(bibleListResponse),
            example: {
              data: [
                { id: "NKJV", name: "New King James Version", abbreviation: "NKJV" }
              ],
              meta: {}
            }
          }
        }
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { unauthorized: errorExamples.unauthorized }
          }
        }
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
    summary: "List books for a bible",
    description: "List books for a bible",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: resolver(booksResponse),
            example: {
              data: [
                { id: "GEN", name: "Genesis", abbreviation: "GEN", chapters: 50 }
              ],
              meta: {}
            }
          }
        }
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { unauthorized: errorExamples.unauthorized }
          }
        }
      },
      404: {
        description: "Not found",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { bibleNotFound: errorExamples.bibleNotFound }
          }
        }
      }
    }
  }),
  validator("param", bibleIdParam),
  async (c) => {
  const { bibleId } = c.req.valid("param");
  if (bibleId !== "NKJV") {
    return c.json(
      { error: { code: "BIBLE_NOT_FOUND", message: "Bible not found." } },
      404
    );
  }

  return fetchR2Json(c, "NKJV/books.json");
  }
);

app.get(
  "/v1/bibles/:bibleId/chapters/:chapterId",
  describeRoute({
    summary: "Fetch a chapter by id",
    description: "Fetch a chapter by id",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: resolver(chapterResponse),
            example: {
              data: {
                id: "GEN.1",
                bibleId: "NKJV",
                content: [{ id: "GEN.1.1", text: "In the beginning..." }]
              },
              meta: {}
            }
          }
        }
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { unauthorized: errorExamples.unauthorized }
          }
        }
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { invalidChapterId: errorExamples.invalidChapterId }
          }
        }
      },
      404: {
        description: "Not found",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { bibleNotFound: errorExamples.bibleNotFound }
          }
        }
      }
    }
  }),
  validator("param", chapterParam),
  async (c) => {
  const { bibleId, chapterId } = c.req.valid("param");
  if (bibleId !== "NKJV") {
    return c.json(
      { error: { code: "BIBLE_NOT_FOUND", message: "Bible not found." } },
      404
    );
  }

  const parsed = parseChapterId(chapterId);
  if (!parsed) {
    return c.json(
      {
        error: {
          code: "INVALID_CHAPTER_ID",
          message: "Invalid chapter id. Expected format BOOK.CHAPTER (e.g., GEN.1)."
        }
      },
      400
    );
  }

  const key = `NKJV/${parsed.bookId}/${parsed.chapter}.json`;
  return fetchR2Json(c, key);
  }
);

app.get(
  "/v1/votd",
  describeRoute({
    summary: "Get the verse of the day",
    description: "Get the verse of the day",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: resolver(votdResponse),
            example: {
              data: {
                id: "GEN.1.1",
                text: "In the beginning God created the heavens and the earth.",
                bibleId: "NKJV",
                bookId: "GEN",
                chapter: "1"
              },
              meta: {}
            }
          }
        }
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { unauthorized: errorExamples.unauthorized }
          }
        }
      },
      404: {
        description: "Not found",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { votdNotSet: errorExamples.votdNotSet }
          }
        }
      }
    }
  }),
  async (c) => {
  const value = await c.env.BIBLE_KV.get("current_votd", "json");
  if (!value) {
    return c.json(
      { error: { code: "VOTD_NOT_SET", message: "Verse of the day not set." } },
      404
    );
  }

  return c.json(value);
  }
);

app.get(
  "/v1/bibles/:bibleId/passages/:passageId",
  describeRoute({
    summary: "Fetch a passage within a chapter",
    description: "Fetch a passage within a chapter",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: resolver(passageResponse),
            example: {
              data: {
                id: "GEN.1.1-GEN.1.5",
                bibleId: "NKJV",
                content: [
                  { id: "GEN.1.1", text: "In the beginning..." },
                  { id: "GEN.1.2", text: "The earth was without form..." }
                ]
              },
              meta: {}
            }
          }
        }
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { unauthorized: errorExamples.unauthorized }
          }
        }
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: {
              invalidPassageId: errorExamples.invalidPassageId,
              passageCrossesChapters: errorExamples.passageCrossesChapters
            }
          }
        }
      },
      404: {
        description: "Not found",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: {
              bibleNotFound: errorExamples.bibleNotFound,
              passageNotFound: errorExamples.passageNotFound
            }
          }
        }
      }
    }
  }),
  validator("param", passageParam),
  async (c) => {
  const { bibleId, passageId } = c.req.valid("param");
  if (bibleId !== "NKJV") {
    return c.json(
      { error: { code: "BIBLE_NOT_FOUND", message: "Bible not found." } },
      404
    );
  }

  const [startRef, endRef] = passageId.split("-");
  const start = parseVerseId(startRef);
  const end = endRef ? parseVerseId(endRef) : start;

  if (!start || !end) {
    return c.json(
      {
        error: {
          code: "INVALID_PASSAGE_ID",
          message:
            "Invalid passage id. Expected format BOOK.CHAPTER.START-BOOK.CHAPTER.END (e.g., GEN.1.1-GEN.1.5)."
        }
      },
      400
    );
  }

  if (start.bookId !== end.bookId || start.chapter !== end.chapter) {
    return c.json(
      {
        error: {
          code: "PASSAGE_CROSSES_CHAPTERS",
          message: "Passage must be within one chapter."
        }
      },
      400
    );
  }

  const key = `NKJV/${start.bookId}/${start.chapter}.json`;
  const obj = await c.env.BIBLE_BUCKET.get(key);
  if (!obj) {
    return c.json(
      { error: { code: "PASSAGE_NOT_FOUND", message: "Passage not found." } },
      404
    );
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
    return c.json(
      { error: { code: "NOT_FOUND", message: "Resource not found." } },
      404
    );
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
