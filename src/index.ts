import { Hono } from "hono";
import type { Context } from "hono";
import { describeRoute, openAPISpecs } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import topVerses from "../top1000_verses.json";
import { auth } from "./middleware/auth.js";
import {
  BIBLES,
  bookOrderIndexFor,
  chaptersForBook,
  getBible,
  resolveBookId,
  resolveBookIdFor,
  type Bible
} from "./mappings.js";
import { scheduled as scheduledHandler } from "./scheduled.js";

type Env = {
  BIBLE_BUCKET: R2Bucket;
  BIBLE_KV: KVNamespace;
  API_KEY: string;
  PUBLIC_BASE_URL?: string;
};

export const app = new Hono<{ Bindings: Env }>();

const bibleIdParam = z.object({ bibleId: z.string() });
const chapterParam = z.object({ bibleId: z.string(), chapterId: z.string() });
const passageParam = z.object({ bibleId: z.string(), passageId: z.string() });
const verseParam = z.object({ bibleId: z.string(), verseId: z.string() });
const bookParam = z.object({ bibleId: z.string(), bookId: z.string() });
const includeNotesQuery = z.object({
  "include-notes": z.enum(["true", "false"]).optional()
});

const supportedBibleIds = BIBLES.map((bible) => bible.id);
const bibleNotFoundError = {
  error: {
    code: "BIBLE_NOT_FOUND",
    message: "Bible not found.",
    hint: `Supported bibles: ${supportedBibleIds.join(", ")}.`
  }
} as const;

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
    value: bibleNotFoundError
  },
  invalidBookId: {
    value: {
      error: {
        code: "INVALID_BOOK_ID",
        message: "Invalid book id. Expected a book code such as GEN."
      }
    }
  },
  notesNotAvailable: {
    value: {
      error: {
        code: "NOTES_NOT_AVAILABLE",
        message: "This bible does not include study notes.",
        hint: "Study notes are available for: OSB."
      }
    }
  },
  downloadNotAvailable: {
    value: {
      error: {
        code: "DOWNLOAD_NOT_AVAILABLE",
        message: "No offline bundle has been published for this bible."
      }
    }
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
  invalidVerseId: {
    value: {
      error: {
        code: "INVALID_VERSE_ID",
        message: "Invalid verse id. Expected format BOOK.CHAPTER.VERSE (e.g., GEN.1.1)."
      }
    }
  },
  invalidPassageRange: {
    value: {
      error: {
        code: "INVALID_PASSAGE_RANGE",
        message: "Passage end must be after the start."
      }
    }
  },
  passageNotFound: {
    value: {
      error: { code: "PASSAGE_NOT_FOUND", message: "Passage not found." }
    }
  },
  verseNotFound: {
    value: {
      error: { code: "VERSE_NOT_FOUND", message: "Verse not found." }
    }
  },
  votdNotSet: {
    value: { error: { code: "VOTD_NOT_SET", message: "Verse of the day not set." } }
  },
  invalidTimezone: {
    value: {
      error: {
        code: "INVALID_TIMEZONE",
        message:
          "Invalid timezone. Use an IANA timezone, e.g., Australia/Sydney or America/New_York."
      }
    }
  },
  notFound: {
    value: { error: { code: "NOT_FOUND", message: "Resource not found." } }
  },
  invalidSearchQuery: {
    value: {
      error: {
        code: "INVALID_SEARCH_QUERY",
        message:
          "Invalid search query. Examples: JHN6:12-15, JHN6-12, John 6:12-15 NKJV."
      }
    }
  }
};

const bibleListResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      abbreviation: z.string(),
      description: z.string(),
      features: z.array(z.string())
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
      chapters: z.number(),
      testament: z.enum(["OT", "NT", "DC"]).optional()
    })
  ),
  meta: z.record(z.unknown()).optional()
});

const noteSchema = z.object({
  id: z.string(),
  type: z.enum(["inline", "footnote", "intro", "sidebar", "unclear", "study", "lectionary", "article"]),
  verseId: z.string().nullable(),
  text: z.string(),
  sequence: z.number(),
  label: z.string().optional()
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
    ),
    notes: z.array(noteSchema).optional()
  }),
  meta: z.record(z.unknown()).optional()
});

const chapterNotesResponse = z.object({
  data: z.object({
    id: z.string(),
    bibleId: z.string(),
    notes: z.array(noteSchema)
  }),
  meta: z.record(z.unknown()).optional()
});

const bookIntroResponse = z.object({
  data: z.object({
    bookId: z.string(),
    bibleId: z.string(),
    notes: z.array(noteSchema)
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

const verseResponse = z.object({
  data: z.object({
    id: z.string(),
    text: z.string(),
    bibleId: z.string(),
    bookId: z.string(),
    chapter: z.string(),
    notes: z.array(noteSchema).optional()
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
                {
                  id: "NKJV",
                  name: "New King James Version",
                  abbreviation: "NKJV",
                  description: "New King James Version.",
                  features: []
                },
                {
                  id: "OSB",
                  name: "Orthodox Study Bible",
                  abbreviation: "OSB",
                  description: "Orthodox Study Bible with study notes.",
                  features: ["notes"]
                }
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
    data: BIBLES.map((bible) => ({
      id: bible.id,
      name: bible.name,
      abbreviation: bible.abbreviation,
      description: bible.description,
      features: bible.features
    })),
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
  const bible = getBible(bibleId);
  if (!bible) {
    return c.json(bibleNotFoundError, 404);
  }

  return fetchR2Json(c, `${bible.id}/books.json`);
  }
);

app.get(
  "/v1/bibles/:bibleId/download",
  describeRoute({
    summary: "Download a complete bible for offline use",
    description:
      "Download the full bible (text plus study notes where available) as a single JSON bundle for offline storage. The bundle uses the same shapes as the online API: data.chapters is keyed by chapter id (e.g. GEN.1), data.notes.chapters by chapter id, data.notes.intros by book id. data.revision is a content hash; send If-None-Match with the previously returned ETag to get 304 Not Modified when your local copy is still current.",
    responses: {
      200: {
        description:
          "OK. The complete bible bundle: { data: { bibleId, revision, books, chapters, notes? }, meta }.",
        content: { "application/json": {} }
      },
      304: { description: "Not modified — the local copy is current." },
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
            examples: {
              bibleNotFound: errorExamples.bibleNotFound,
              downloadNotAvailable: errorExamples.downloadNotAvailable
            }
          }
        }
      }
    }
  }),
  validator("param", bibleIdParam),
  async (c) => {
    const { bibleId } = c.req.valid("param");
    const bible = getBible(bibleId);
    if (!bible) {
      return c.json(bibleNotFoundError, 404);
    }

    const obj = await c.env.BIBLE_BUCKET.get(`${bible.id}/bundle.json`);
    if (!obj) {
      return c.json(errorExamples.downloadNotAvailable.value, 404);
    }

    const etag = obj.httpEtag;
    const headers: Record<string, string> = {
      etag,
      "cache-control": "private, max-age=3600"
    };
    if (c.req.header("if-none-match") === etag) {
      return c.body(null, 304, headers);
    }

    return c.body(obj.body, 200, {
      ...headers,
      "content-type": "application/json"
    });
  }
);

app.get(
  "/v1/bibles/:bibleId/chapters/:chapterId",
  describeRoute({
    summary: "Fetch a chapter by id",
    description:
      "Fetch a chapter by id. Example: /v1/bibles/NKJV/chapters/GEN.1. Pass include-notes=true to embed study notes (bibles with the notes feature only).",
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
  validator("query", includeNotesQuery),
  async (c) => {
  const { bibleId, chapterId } = c.req.valid("param");
  const includeNotes = c.req.valid("query")["include-notes"] === "true";
  const bible = getBible(bibleId);
  if (!bible) {
    return c.json(bibleNotFoundError, 404);
  }

  const parsed = parseChapterId(bible, chapterId);
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

  const key = `${bible.id}/${parsed.bookId}/${parsed.chapter}.json`;
  if (!includeNotes) {
    return fetchR2Json(c, key);
  }

  const obj = await c.env.BIBLE_BUCKET.get(key);
  if (!obj) {
    return c.json(
      { error: { code: "NOT_FOUND", message: "Resource not found." } },
      404
    );
  }

  const chapterData = (await obj.json()) as {
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  };
  const notes = await loadChapterNotes(c, bible, parsed.bookId, parsed.chapter);

  c.header("cache-control", CONTENT_CACHE_CONTROL);
  return c.json({
    data: { ...(chapterData?.data ?? {}), notes },
    meta: chapterData?.meta ?? {}
  });
  }
);

app.get(
  "/v1/bibles/:bibleId/verses/:verseId",
  describeRoute({
    summary: "Fetch a single verse by id",
    description:
      "Fetch a single verse by id. Example: /v1/bibles/NKJV/verses/GEN.1.1. Pass include-notes=true to embed study notes anchored to this verse (bibles with the notes feature only).",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: resolver(verseResponse),
            example: {
              data: {
                id: "GEN.1.1",
                text: "In the beginning...",
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
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { invalidVerseId: errorExamples.invalidVerseId }
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
              verseNotFound: errorExamples.verseNotFound
            }
          }
        }
      }
    }
  }),
  validator("param", verseParam),
  validator("query", includeNotesQuery),
  async (c) => {
    const { bibleId, verseId } = c.req.valid("param");
    const includeNotes = c.req.valid("query")["include-notes"] === "true";
    const bible = getBible(bibleId);
    if (!bible) {
      return c.json(bibleNotFoundError, 404);
    }

    const parsed = parseSingleVerseId(bible, verseId);
    if (!parsed) {
      return c.json(errorExamples.invalidVerseId.value, 400);
    }

    const normalizedVerseId = `${parsed.bookId}.${parsed.chapter}.${parsed.verse}`;
    const key = `${bible.id}/${parsed.bookId}/${parsed.chapter}.json`;
    const obj = await c.env.BIBLE_BUCKET.get(key);
    if (!obj) {
      return c.json(errorExamples.verseNotFound.value, 404);
    }

    const chapterData = (await obj.json()) as {
      data?: { content?: Array<{ id: string; text: string }> };
    };
    const verses = chapterData?.data?.content ?? [];
    const verse = verses.find((item) => item.id === normalizedVerseId);
    if (!verse) {
      return c.json(errorExamples.verseNotFound.value, 404);
    }

    const data: Record<string, unknown> = {
      id: verse.id,
      text: verse.text,
      bibleId: bible.id,
      bookId: parsed.bookId,
      chapter: String(parsed.chapter)
    };

    if (includeNotes) {
      const notes = await loadChapterNotes(c, bible, parsed.bookId, String(parsed.chapter));
      data.notes = notes.filter((note) => note.verseId === normalizedVerseId);
    }

    c.header("cache-control", CONTENT_CACHE_CONTROL);
    return c.json({ data, meta: {} });
  }
);

app.get(
  "/v1/bibles/:bibleId/chapters/:chapterId/notes",
  describeRoute({
    summary: "Fetch study notes for a chapter",
    description:
      "Fetch study notes anchored within a chapter, in document order. Example: /v1/bibles/OSB/chapters/GEN.1/notes. Only available for bibles with the notes feature.",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: resolver(chapterNotesResponse),
            example: {
              data: {
                id: "GEN.1",
                bibleId: "OSB",
                notes: [
                  {
                    id: "n11",
                    type: "sidebar",
                    verseId: "GEN.1.28",
                    text: "THE HOLY TRINITY",
                    sequence: 1
                  }
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
            examples: { invalidChapterId: errorExamples.invalidChapterId }
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
              notesNotAvailable: errorExamples.notesNotAvailable
            }
          }
        }
      }
    }
  }),
  validator("param", chapterParam),
  async (c) => {
    const { bibleId, chapterId } = c.req.valid("param");
    const bible = getBible(bibleId);
    if (!bible) {
      return c.json(bibleNotFoundError, 404);
    }
    if (!bible.features.includes("notes")) {
      return c.json(errorExamples.notesNotAvailable.value, 404);
    }

    const parsed = parseChapterId(bible, chapterId);
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

    const notes = await loadChapterNotes(c, bible, parsed.bookId, parsed.chapter);
    c.header("cache-control", CONTENT_CACHE_CONTROL);
    return c.json({
      data: {
        id: `${parsed.bookId}.${parsed.chapter}`,
        bibleId: bible.id,
        notes
      },
      meta: {}
    });
  }
);

app.get(
  "/v1/bibles/:bibleId/books/:bookId/intro",
  describeRoute({
    summary: "Fetch a book introduction",
    description:
      "Fetch the introduction notes for a book (author, date, major themes, background). Example: /v1/bibles/OSB/books/GEN/intro. Only available for bibles with the notes feature.",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: resolver(bookIntroResponse),
            example: {
              data: {
                bookId: "GEN",
                bibleId: "OSB",
                notes: [
                  {
                    id: "n1",
                    type: "intro",
                    verseId: null,
                    text: "Author — Traditionally, both Jews and Christians believe Moses is the author...",
                    sequence: 1
                  }
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
            examples: { invalidBookId: errorExamples.invalidBookId }
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
              notesNotAvailable: errorExamples.notesNotAvailable
            }
          }
        }
      }
    }
  }),
  validator("param", bookParam),
  async (c) => {
    const { bibleId, bookId } = c.req.valid("param");
    const bible = getBible(bibleId);
    if (!bible) {
      return c.json(bibleNotFoundError, 404);
    }
    if (!bible.features.includes("notes")) {
      return c.json(errorExamples.notesNotAvailable.value, 404);
    }

    const resolvedBookId = resolveBookIdFor(bible, bookId);
    if (!resolvedBookId) {
      return c.json(errorExamples.invalidBookId.value, 400);
    }

    const obj = await c.env.BIBLE_BUCKET.get(
      `${bible.id}/notes/${resolvedBookId}/intro.json`
    );
    const notes = obj ? await parseNotesObject(obj) : [];

    c.header("cache-control", CONTENT_CACHE_CONTROL);
    return c.json({
      data: {
        bookId: resolvedBookId,
        bibleId: bible.id,
        notes
      },
      meta: {}
    });
  }
);

app.get(
  "/v1/votd",
  describeRoute({
    summary: "Get the verse of the day",
    description:
      "Get the verse of the day. Optionally send timezone to localize by user's day.",
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
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { invalidTimezone: errorExamples.invalidTimezone }
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
  validator(
    "query",
    z.object({
      timezone: z.string().optional()
    })
  ),
  async (c) => {
  const { timezone } = c.req.valid("query");
  const requestedTimeZone = timezone?.trim();
  if (requestedTimeZone) {
    if (!isValidTimeZone(requestedTimeZone)) {
      return c.json(errorExamples.invalidTimezone.value, 400);
    }

    const localized = await resolveLocalizedVotd(c, requestedTimeZone);
    if (localized) {
      return c.json(localized);
    }
  }

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
  "/v1/search",
  describeRoute({
    summary: "Search passages",
    description:
      "Search passages with flexible input. Examples: JHN6:12-15, JHN6-12, John 6:12-15 NKJV, JHN.21.25-ACT.1.3.",
    responses: {
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: resolver(passageResponse),
            example: {
              data: {
                id: "JHN.6.1-JHN.6.12",
                bibleId: "NKJV",
                content: [
                  { id: "JHN.6.1", text: "After these things..." },
                  { id: "JHN.6.2", text: "Then a great multitude..." }
                ]
              },
              meta: {}
            }
          }
        }
      },
      400: {
        description: "Bad request",
        content: {
          "application/json": {
            schema: resolver(errorResponse),
            examples: { invalidSearchQuery: errorExamples.invalidSearchQuery }
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
            examples: { passageNotFound: errorExamples.passageNotFound }
          }
        }
      }
    }
  }),
  validator(
    "query",
    z.object({
      q: z.string().optional(),
      query: z.string().optional(),
      bibleId: z.string().optional()
    })
  ),
  async (c) => {
    const { q, query, bibleId } = c.req.valid("query");
    const bible = getBible(bibleId ?? "NKJV");
    if (!bible) {
      return c.json(bibleNotFoundError, 404);
    }

    const raw = (q ?? query ?? "").trim();
    if (!raw) {
      return c.json(errorExamples.invalidSearchQuery.value, 400);
    }

    const parsed = parseSearchQuery(bible, raw);
    if ("error" in parsed) {
      return c.json({ error: parsed.error }, 400);
    }

    const result = await resolvePassages(c, bible, parsed.passageIds);
    if ("error" in result) {
      return c.json({ error: result.error }, result.status);
    }

    return c.json({
      data: {
        id: parsed.normalized,
        bibleId: bible.id,
        content: result.content
      },
      meta: { query: raw }
    });
  }
);

app.get(
  "/v1/bibles/:bibleId/passages/:passageId",
  describeRoute({
    summary: "Fetch a passage within a chapter",
    description:
      "Fetch a passage. Examples: GEN.1.1-GEN.1.5, JHN.1.12-15, JHN.1.12-2.5, JHN.21.25-ACT.1.3.",
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
              invalidPassageRange: errorExamples.invalidPassageRange
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
  const bible = getBible(bibleId);
  if (!bible) {
    return c.json(bibleNotFoundError, 404);
  }

  const passageResult = await resolvePassages(c, bible, [passageId]);
  if ("error" in passageResult) {
    return c.json({ error: passageResult.error }, passageResult.status);
  }

  c.header("cache-control", CONTENT_CACHE_CONTROL);
  return c.json({
    data: {
      id: passageId,
      bibleId: bible.id,
      content: passageResult.content
    },
    meta: {}
  });
  }
);

function parseChapterId(bible: Bible, chapterId: string) {
  const [bookId, chapterStr] = chapterId.split(".");
  const chapter = Number(chapterStr);
  if (!bookId || Number.isNaN(chapter)) return null;
  const maxChapters = chaptersForBook(bible, bookId);
  if (!maxChapters || chapter < 1 || chapter > maxChapters) return null;
  return { bookId, chapter: String(chapter) };
}

type VerseRef = { bookId: string; chapter: number; verse: number };

function parseSingleVerseId(bible: Bible, verseId: string): VerseRef | null {
  const parts = verseId.split(".");
  if (parts.length !== 3) return null;
  const [bookId, chapterStr, verseStr] = parts;
  const chapter = Number(chapterStr);
  const verse = Number(verseStr);
  if (!bookId || Number.isNaN(chapter) || Number.isNaN(verse)) return null;
  const maxChapters = chaptersForBook(bible, bookId);
  if (!maxChapters || chapter < 1 || chapter > maxChapters) return null;
  if (verse < 1) return null;
  return { bookId, chapter, verse };
}

function parseVerseRef(
  bible: Bible,
  ref: string | undefined,
  defaults?: { bookId: string; chapter: number }
): VerseRef | null {
  if (!ref) return null;
  const parts = ref.split(".");
  let bookId = defaults?.bookId;
  let chapterStr: string | undefined;
  let verseStr: string | undefined;

  if (parts.length === 3) {
    [bookId, chapterStr, verseStr] = parts;
  } else if (parts.length === 2) {
    [chapterStr, verseStr] = parts;
  } else if (parts.length === 1) {
    verseStr = parts[0];
  } else {
    return null;
  }

  if (!bookId) return null;
  const chapter = Number(chapterStr ?? defaults?.chapter);
  const verse = Number(verseStr);
  if (Number.isNaN(chapter) || Number.isNaN(verse)) return null;
  const maxChapters = chaptersForBook(bible, bookId);
  if (!maxChapters || chapter < 1 || chapter > maxChapters) return null;
  if (verse < 1) return null;
  return { bookId, chapter, verse };
}

function parsePassageId(
  bible: Bible,
  passageId: string
): { start: VerseRef; end: VerseRef } | { error: { code: string; message: string } } {
  const [startRef, endRef] = passageId.split("-");
  const start = parseVerseRef(bible, startRef);
  if (!start) {
    return {
      error: {
        code: "INVALID_PASSAGE_ID",
        message:
          "Invalid passage id. Expected format BOOK.CHAPTER.START-BOOK.CHAPTER.END (e.g., GEN.1.1-GEN.1.5)."
      }
    };
  }

  const end = endRef
    ? parseVerseRef(bible, endRef, { bookId: start.bookId, chapter: start.chapter })
    : start;
  if (!end) {
    return {
      error: {
        code: "INVALID_PASSAGE_ID",
        message:
          "Invalid passage id. Expected format BOOK.CHAPTER.START-BOOK.CHAPTER.END (e.g., GEN.1.1-GEN.1.5)."
      }
    };
  }

  const startIdx = bookOrderIndexFor(bible, start.bookId);
  const endIdx = bookOrderIndexFor(bible, end.bookId);
  if (startIdx === undefined || endIdx === undefined) {
    return {
      error: {
        code: "INVALID_PASSAGE_ID",
        message:
          "Invalid passage id. Expected format BOOK.CHAPTER.START-BOOK.CHAPTER.END (e.g., GEN.1.1-GEN.1.5)."
      }
    };
  }

  if (
    endIdx < startIdx ||
    (endIdx === startIdx &&
      (end.chapter < start.chapter ||
        (end.chapter === start.chapter && end.verse < start.verse)))
  ) {
    return {
      error: {
        code: "INVALID_PASSAGE_RANGE",
        message: "Passage end must be after the start."
      }
    };
  }

  return { start, end };
}

function parseSearchQuery(
  bible: Bible,
  query: string
):
  | { passageIds: string[]; normalized: string }
  | { error: { code: string; message: string } } {
  const cleaned = normalizeSearchQuery(query);
  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return {
      error: {
        code: "INVALID_SEARCH_QUERY",
        message:
          "Invalid search query. Examples: JHN6:12-15, JHN6-12, John 6:12-15 NKJV."
      }
    };
  }

  const passageIds: string[] = [];
  for (const part of parts) {
    const parsed = parseSearchSegment(bible, part);
    if (!parsed) {
      return {
        error: {
          code: "INVALID_SEARCH_QUERY",
          message:
          "Invalid search query. Examples: JHN6:12-15, JHN6-12, John 6:12-15 NKJV."
        }
      };
    }
    passageIds.push(parsed);
  }

  return { passageIds, normalized: passageIds.join(",") };
}

function parseSearchSegment(bible: Bible, input: string): string | null {
  const cleaned = input.replace(/\s+/g, "").toUpperCase();
  const split = cleaned.split("-");
  if (split.length > 2) return null;
  const [startToken, endToken] = split;
  const start = parseSearchRef(bible, startToken);
  if (!start) return null;

  if (!endToken) {
    const verse = start.verse ?? 1;
    return `${start.bookId}.${start.chapter}.${verse}-${start.bookId}.${start.chapter}.${verse}`;
  }

  const end = parseSearchEndRef(bible, endToken, start);
  if (!end) return null;

  const startVerse = start.verse ?? 1;
  const endVerse = end.verse ?? 9999;
  return `${start.bookId}.${start.chapter}.${startVerse}-${end.bookId}.${end.chapter}.${endVerse}`;
}

function parseSearchRef(
  bible: Bible,
  token: string
): { bookId: string; chapter: number; verse?: number } | null {
  const tokens = token
    .replace(/[^\w:.]+/g, " ")
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return null;

  let normalized = "";
  const last = tokens[tokens.length - 1];
  const secondLast = tokens[tokens.length - 2];
  const lastIsNumber = /^\d+$/.test(last);
  const secondLastIsNumber = secondLast ? /^\d+$/.test(secondLast) : false;

  if (tokens.length >= 3 && lastIsNumber && secondLastIsNumber) {
    const bookToken = tokens.slice(0, -2).join("");
    normalized = `${bookToken}${secondLast}:${last}`;
  } else {
    normalized = tokens.join("");
  }

  normalized = normalized.replace(/^([A-Z0-9]+)\./, "$1");

  const match = normalized.match(/^([A-Z0-9]+?)(\d+)(?:[.:](\d+))?$/);
  if (!match) return null;
  const [, bookToken, chapterStr, verseStr] = match;
  const bookId = resolveBookIdFor(bible, bookToken);
  if (!bookId) return null;
  const chapter = Number(chapterStr);
  if (Number.isNaN(chapter) || chapter < 1) return null;
  if (chapter > (chaptersForBook(bible, bookId) ?? 0)) return null;
  if (!verseStr) {
    return { bookId, chapter };
  }
  const verse = Number(verseStr);
  if (Number.isNaN(verse) || verse < 1) return null;
  return { bookId, chapter, verse };
}

function parseSearchEndRef(
  bible: Bible,
  token: string,
  start: { bookId: string; chapter: number; verse?: number }
): { bookId: string; chapter: number; verse?: number } | null {
  const hasLetters = /[A-Z]/.test(token);
  if (hasLetters) {
    return parseSearchRef(bible, token);
  }

  const normalized = token.replace(":", ".");
  if (normalized.includes(".")) {
    const [chapterStr, verseStr] = normalized.split(".");
    const chapter = Number(chapterStr);
    if (Number.isNaN(chapter) || chapter < 1) return null;
    const verse = verseStr ? Number(verseStr) : undefined;
    if (verse !== undefined && (Number.isNaN(verse) || verse < 1)) return null;
    return { bookId: start.bookId, chapter, verse };
  }

  const verse = Number(normalized);
  if (Number.isNaN(verse) || verse < 1) return null;
  return { bookId: start.bookId, chapter: start.chapter, verse };
}

function normalizeSearchQuery(query: string) {
  let cleaned = query.replace(/[–—]/g, "-");
  cleaned = cleaned.replace(/\(([^)]+)\)$/g, " ");
  cleaned = cleaned.replace(/\bVERSION\s*=\s*[A-Z0-9]+\b/gi, " ");
  cleaned = cleaned.replace(
    /\b(NKJV|OSB|KJV|NIV|ESV|NLT|NASB|CSB|RSV|NRSV|NRSVUE|NLV|GNT|CEV)\b/gi,
    " "
  );
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

async function resolvePassages(
  c: Context<{ Bindings: Env }>,
  bible: Bible,
  passageIds: string[]
): Promise<
  | { content: Array<{ id: string; text: string }> }
  | { error: { code: string; message: string }; status: 400 | 404 }
> {
  const content: Array<{ id: string; text: string }> = [];
  for (const passageId of passageIds) {
    const parsed = parsePassageId(bible, passageId);
    if ("error" in parsed) {
      return { error: parsed.error, status: 400 };
    }

    const { start, end } = parsed;
    const bookOrder = bible.books.map((book) => book.id);
    const startIdx = bookOrder.indexOf(start.bookId);
    const endIdx = bookOrder.indexOf(end.bookId);

    for (let b = startIdx; b <= endIdx; b += 1) {
      const bookId = bookOrder[b];
      const maxChapters = chaptersForBook(bible, bookId) ?? 0;
      const firstChapter = bookId === start.bookId ? start.chapter : 1;
      const lastChapter = bookId === end.bookId ? end.chapter : maxChapters;

      for (let chapter = firstChapter; chapter <= lastChapter; chapter += 1) {
        const key = `${bible.id}/${bookId}/${chapter}.json`;
        const obj = await c.env.BIBLE_BUCKET.get(key);
        if (!obj) {
          return {
            error: { code: "PASSAGE_NOT_FOUND", message: "Passage not found." },
            status: 404
          };
        }

        const chapterData = (await obj.json()) as {
          data?: { content?: Array<{ id: string; text: string }> };
        };

        const verses = chapterData?.data?.content ?? [];
        const filtered = verses.filter((verse) => {
          const verseNum = Number(verse.id.split(".").pop());
          if (Number.isNaN(verseNum)) return false;
          if (
            bookId === start.bookId &&
            chapter === start.chapter &&
            bookId === end.bookId &&
            chapter === end.chapter
          ) {
            return verseNum >= start.verse && verseNum <= end.verse;
          }
          if (bookId === start.bookId && chapter === start.chapter) {
            return verseNum >= start.verse;
          }
          if (bookId === end.bookId && chapter === end.chapter) {
            return verseNum <= end.verse;
          }
          return true;
        });

        content.push(...filtered);
      }
    }
  }

  if (!content.length) {
    return {
      error: { code: "PASSAGE_NOT_FOUND", message: "Passage not found." },
      status: 404
    };
  }

  return { content };
}

type StudyNote = {
  id: string;
  type: string;
  verseId: string | null;
  text: string;
  sequence: number;
  /** Printed verse reference for study/lectionary notes, e.g. "1:31". */
  label?: string;
};

async function parseNotesObject(obj: R2ObjectBody): Promise<StudyNote[]> {
  const payload = (await obj.json()) as {
    data?: { notes?: StudyNote[] };
  };
  return payload?.data?.notes ?? [];
}

async function loadChapterNotes(
  c: Context<{ Bindings: Env }>,
  bible: Bible,
  bookId: string,
  chapter: string
): Promise<StudyNote[]> {
  if (!bible.features.includes("notes")) return [];
  const obj = await c.env.BIBLE_BUCKET.get(
    `${bible.id}/notes/${bookId}/${chapter}.json`
  );
  if (!obj) return [];
  return parseNotesObject(obj);
}

// Bible content is immutable, so let clients cache it. `private` (not
// `public`) because responses are gated by the api-key header: shared caches
// (including Cloudflare's edge cache for Workers, if ever enabled) key on the
// URL and would serve cached content to unauthenticated requests.
const CONTENT_CACHE_CONTROL = "private, max-age=86400";

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

  const headers: Record<string, string> = {
    etag: obj.httpEtag,
    "cache-control": CONTENT_CACHE_CONTROL
  };
  if (c.req.header("if-none-match") === obj.httpEtag) {
    return c.body(null, 304, headers);
  }

  return c.body(obj.body, 200, {
    ...headers,
    "content-type": obj.httpMetadata?.contentType ?? "application/json"
  });
}

function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getLocalDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function parseTopVerseReference(reference: string) {
  const match = reference.match(/^(.+?)\s+(\d+)(?::([\d-]+))?$/);
  if (!match) return null;

  const bookName = match[1].trim();
  const bookId = resolveBookId(bookName);
  if (!bookId) return null;

  const chapter = Number(match[2]);
  const versePart = match[3] ?? "1";
  const verse = Number(versePart.split("-")[0]);
  if (Number.isNaN(chapter) || Number.isNaN(verse)) return null;
  return { bookId, chapter, verse };
}

async function resolveLocalizedVotd(
  c: Context<{ Bindings: Env }>,
  timeZone: string
): Promise<
  | {
      data: {
        id: string;
        text: string;
        bibleId: string;
        bookId: string;
        chapter: string;
      };
      meta: {
        timezone: string;
        localDate: string;
        sourceReference: string;
      };
    }
  | null
> {
  const entries = topVerses as Array<{ reference?: string }>;
  if (!entries.length) return null;

  const localDate = getLocalDateInTimeZone(new Date(), timeZone);
  const startIndex = hashString(`NKJV:${localDate}`) % entries.length;

  for (let offset = 0; offset < entries.length; offset += 1) {
    const entry = entries[(startIndex + offset) % entries.length];
    const reference = entry.reference?.trim();
    if (!reference) continue;

    const parsed = parseTopVerseReference(reference);
    if (!parsed) continue;

    const key = `NKJV/${parsed.bookId}/${parsed.chapter}.json`;
    const obj = await c.env.BIBLE_BUCKET.get(key);
    if (!obj) continue;

    const chapterData = (await obj.json()) as {
      data?: { content?: Array<{ id: string; text: string }> };
    };

    const verseId = `${parsed.bookId}.${parsed.chapter}.${parsed.verse}`;
    const verse = chapterData?.data?.content?.find((item) => item.id === verseId);
    if (!verse) continue;

    return {
      data: {
        ...verse,
        bibleId: "NKJV",
        bookId: parsed.bookId,
        chapter: String(parsed.chapter)
      },
      meta: {
        timezone: timeZone,
        localDate,
        sourceReference: reference
      }
    };
  }

  return null;
}

app.get("/openapi.json", (c) => {
  const origin = new URL(c.req.url).origin;
  const baseUrl = c.env.PUBLIC_BASE_URL || origin;
  const handler = openAPISpecs(app as unknown as Hono, {
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
      servers: [{ url: baseUrl, description: "Current" }]
    }
  });
  return handler(c as unknown as Parameters<typeof handler>[0]);
});

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

export default {
  fetch: app.fetch,
  scheduled: scheduledHandler
};
