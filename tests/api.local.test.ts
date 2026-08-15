import { describe, expect, test, vi } from "vitest";
import { app } from "../src/index.js";

type R2Object = {
  body: string;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
  json: () => Promise<unknown>;
};

function createR2Object(payload: unknown): R2Object {
  const body = JSON.stringify(payload);
  return {
    body,
    httpEtag: `"etag-${body.length}"`,
    httpMetadata: { contentType: "application/json" },
    json: async () => payload
  };
}

function createMockR2(data: Record<string, unknown>) {
  return {
    get: async (key: string) => {
      const payload = data[key];
      if (!payload) return null;
      return createR2Object(payload);
    }
  } as unknown as R2Bucket;
}

function createMockKv(value: unknown) {
  return {
    get: async (_key: string, type?: "json") => {
      if (type === "json") return value as any;
      return JSON.stringify(value);
    }
  } as unknown as KVNamespace;
}

const mockData = {
  "NKJV/books.json": {
    data: [{ id: "GEN", name: "Genesis", abbreviation: "GEN", chapters: 50 }],
    meta: {}
  },
  "NKJV/GEN/1.json": {
    data: {
      id: "GEN.1",
      bibleId: "NKJV",
      content: [
        { id: "GEN.1.1", text: "In the beginning..." },
        { id: "GEN.1.2", text: "The earth was without form..." },
        { id: "GEN.1.3", text: "Then God said..." }
      ]
    },
    meta: {}
  },
  "NKJV/JHN/6.json": {
    data: {
      id: "JHN.6",
      bibleId: "NKJV",
      content: [
        { id: "JHN.6.12", text: "Gather up the fragments..." },
        { id: "JHN.6.13", text: "Therefore they gathered them..." },
        { id: "JHN.6.14", text: "Then those men..." },
        { id: "JHN.6.15", text: "Therefore when Jesus..." }
      ]
    },
    meta: {}
  },
  "NKJV/JHN/21.json": {
    data: {
      id: "JHN.21",
      bibleId: "NKJV",
      content: [{ id: "JHN.21.25", text: "And there are also many other things..." }]
    },
    meta: {}
  },
  "NKJV/ACT/1.json": {
    data: {
      id: "ACT.1",
      bibleId: "NKJV",
      content: [
        { id: "ACT.1.1", text: "The former account I made..." },
        { id: "ACT.1.2", text: "until the day..." },
        { id: "ACT.1.3", text: "to whom He also presented Himself..." }
      ]
    },
    meta: {}
  },
  "OSB/books.json": {
    data: [
      { id: "GEN", name: "Genesis", abbreviation: "GEN", chapters: 50, testament: "OT" },
      { id: "TOB", name: "Tobit", abbreviation: "TOB", chapters: 14, testament: "DC" }
    ],
    meta: {}
  },
  "OSB/GEN/1.json": {
    data: {
      id: "GEN.1",
      bibleId: "OSB",
      content: [
        { id: "GEN.1.1", text: "In the beginning God made heaven and earth." },
        { id: "GEN.1.2", text: "The earth was invisible and unfinished..." }
      ]
    },
    meta: {}
  },
  "OSB/notes/GEN/1.json": {
    data: {
      id: "GEN.1",
      bibleId: "OSB",
      notes: [
        {
          id: "n11",
          type: "sidebar",
          verseId: "GEN.1.1",
          text: "THE HOLY TRINITY",
          sequence: 1
        },
        {
          id: "n12",
          type: "inline",
          verseId: "GEN.1.2",
          text: "The Holy Trinity is revealed in both testaments.",
          sequence: 2
        }
      ]
    },
    meta: {}
  },
  "OSB/notes/GEN/intro.json": {
    data: {
      bookId: "GEN",
      bibleId: "OSB",
      notes: [
        {
          id: "n1",
          type: "intro",
          verseId: null,
          text: "Author — Traditionally Moses.",
          sequence: 1
        }
      ]
    },
    meta: {}
  },
  "OSB/PSA/151.json": {
    data: {
      id: "PSA.151",
      bibleId: "OSB",
      content: [
        { id: "PSA.151.1", text: "This is a psalm written with David's own hand..." }
      ]
    },
    meta: {}
  },
  "OSB/TOB/1.json": {
    data: {
      id: "TOB.1",
      bibleId: "OSB",
      content: [
        { id: "TOB.1.1", text: "The book of the words of Tobit..." },
        { id: "TOB.1.2", text: "who in the days of Shalmaneser..." }
      ]
    },
    meta: {}
  },
  "OSB/bundle.json": {
    data: {
      bibleId: "OSB",
      revision: "abc123",
      books: [
        { id: "GEN", name: "Genesis", abbreviation: "GEN", chapters: 50, testament: "OT" }
      ],
      chapters: {
        "GEN.1": [{ id: "GEN.1.1", text: "In the beginning God made heaven and earth." }]
      },
      notes: {
        chapters: { "GEN.1": [] },
        intros: { GEN: [] }
      }
    },
    meta: { generatedAt: "2026-01-01T00:00:00.000Z" }
  }
};

const env = {
  API_KEY: "test-key",
  BIBLE_BUCKET: createMockR2(mockData),
  BIBLE_KV: createMockKv({
    data: {
      id: "GEN.1.1",
      text: "In the beginning...",
      bibleId: "NKJV",
      bookId: "GEN",
      chapter: "1"
    },
    meta: {}
  }),
  PUBLIC_BASE_URL: "http://localhost:8787"
};

describe("API (local)", () => {
  test("rejects missing api-key", async () => {
    const res = await app.request("/v1/bibles", {}, env);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("GET /v1/bibles", async () => {
    const res = await app.request(
      "/v1/bibles",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    const ids = body.data.map((bible: { id: string }) => bible.id);
    expect(ids).toContain("NKJV");
    expect(ids).toContain("OSB");
    const osb = body.data.find((bible: { id: string }) => bible.id === "OSB");
    expect(osb.features).toContain("notes");
  });

  test("GET /v1/bibles/UNKNOWN/books returns BIBLE_NOT_FOUND", async () => {
    const res = await app.request(
      "/v1/bibles/UNKNOWN/books",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("BIBLE_NOT_FOUND");
  });

  test("GET /v1/bibles/NKJV/books", async () => {
    const res = await app.request(
      "/v1/bibles/NKJV/books",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].id).toBe("GEN");
  });

  test("GET /v1/bibles/NKJV/chapters/GEN.1", async () => {
    const res = await app.request(
      "/v1/bibles/NKJV/chapters/GEN.1",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("GEN.1");
    expect(body.data.content.length).toBeGreaterThan(0);
  });

  test("GET /v1/bibles/NKJV/passages/GEN.1.1-GEN.1.2", async () => {
    const res = await app.request(
      "/v1/bibles/NKJV/passages/GEN.1.1-GEN.1.2",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.content.length).toBe(2);
    expect(body.data.content[0].id).toBe("GEN.1.1");
    expect(body.data.content[1].id).toBe("GEN.1.2");
  });

  test("GET /v1/bibles/NKJV/verses/GEN.1.1", async () => {
    const res = await app.request(
      "/v1/bibles/NKJV/verses/GEN.1.1",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("GEN.1.1");
    expect(body.data.text).toBe("In the beginning...");
  });

  test("GET /v1/bibles/OSB/books", async () => {
    const res = await app.request(
      "/v1/bibles/OSB/books",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].id).toBe("GEN");
    expect(body.data[1].testament).toBe("DC");
  });

  test("GET /v1/bibles/OSB/chapters/GEN.1", async () => {
    const res = await app.request(
      "/v1/bibles/OSB/chapters/GEN.1",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("GEN.1");
    expect(body.data.bibleId).toBe("OSB");
    expect(body.data.notes).toBeUndefined();
  });

  test("GET /v1/bibles/OSB/chapters/GEN.1?include-notes=true", async () => {
    const res = await app.request(
      "/v1/bibles/OSB/chapters/GEN.1?include-notes=true",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.content.length).toBe(2);
    expect(body.data.notes.length).toBe(2);
    expect(body.data.notes[0].verseId).toBe("GEN.1.1");
  });

  test("GET /v1/bibles/OSB/chapters/GEN.1/notes", async () => {
    const res = await app.request(
      "/v1/bibles/OSB/chapters/GEN.1/notes",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("GEN.1");
    expect(body.data.notes.length).toBe(2);
    expect(body.data.notes[0].type).toBe("sidebar");
  });

  test("GET /v1/bibles/NKJV/chapters/GEN.1/notes returns NOTES_NOT_AVAILABLE", async () => {
    const res = await app.request(
      "/v1/bibles/NKJV/chapters/GEN.1/notes",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOTES_NOT_AVAILABLE");
  });

  test("GET /v1/bibles/OSB/books/GEN/intro", async () => {
    const res = await app.request(
      "/v1/bibles/OSB/books/GEN/intro",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.bookId).toBe("GEN");
    expect(body.data.notes[0].type).toBe("intro");
  });

  test("GET /v1/bibles/OSB/verses/GEN.1.2?include-notes=true", async () => {
    const res = await app.request(
      "/v1/bibles/OSB/verses/GEN.1.2?include-notes=true",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("GEN.1.2");
    expect(body.data.bibleId).toBe("OSB");
    expect(body.data.notes.length).toBe(1);
    expect(body.data.notes[0].id).toBe("n12");
  });

  test("OSB accepts Psalm 151, NKJV rejects it", async () => {
    const osbRes = await app.request(
      "/v1/bibles/OSB/chapters/PSA.151",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(osbRes.status).toBe(200);
    const osbBody = await osbRes.json();
    expect(osbBody.data.id).toBe("PSA.151");

    const nkjvRes = await app.request(
      "/v1/bibles/NKJV/chapters/PSA.151",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(nkjvRes.status).toBe(400);
    const nkjvBody = await nkjvRes.json();
    expect(nkjvBody.error.code).toBe("INVALID_CHAPTER_ID");
  });

  test("GET /v1/search?q=Tobit 1:1-2&bibleId=OSB (deuterocanonical)", async () => {
    const res = await app.request(
      "/v1/search?q=Tobit%201:1-2&bibleId=OSB",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.bibleId).toBe("OSB");
    expect(body.data.content.length).toBe(2);
    expect(body.data.content[0].id).toBe("TOB.1.1");
  });

  test("GET /v1/search with unknown bibleId returns BIBLE_NOT_FOUND", async () => {
    const res = await app.request(
      "/v1/search?q=GEN1:1&bibleId=XYZ",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("BIBLE_NOT_FOUND");
  });

  test("GET /v1/bibles/OSB/download returns the offline bundle", async () => {
    const res = await app.request(
      "/v1/bibles/OSB/download",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBeTruthy();
    expect(res.headers.get("cache-control")).toContain("private");
    const body = await res.json();
    expect(body.data.bibleId).toBe("OSB");
    expect(body.data.revision).toBe("abc123");
    expect(body.data.chapters["GEN.1"].length).toBe(1);
  });

  test("GET /v1/bibles/OSB/download honors If-None-Match with 304", async () => {
    const first = await app.request(
      "/v1/bibles/OSB/download",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    const etag = first.headers.get("etag")!;
    const second = await app.request(
      "/v1/bibles/OSB/download",
      { headers: { "api-key": env.API_KEY, "if-none-match": etag } },
      env
    );
    expect(second.status).toBe(304);
  });

  test("GET /v1/bibles/NKJV/download without bundle returns DOWNLOAD_NOT_AVAILABLE", async () => {
    const res = await app.request(
      "/v1/bibles/NKJV/download",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("DOWNLOAD_NOT_AVAILABLE");
  });

  test("content endpoints send cache headers and honor If-None-Match", async () => {
    const first = await app.request(
      "/v1/bibles/NKJV/chapters/GEN.1",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toContain("private");
    const etag = first.headers.get("etag")!;
    expect(etag).toBeTruthy();

    const second = await app.request(
      "/v1/bibles/NKJV/chapters/GEN.1",
      { headers: { "api-key": env.API_KEY, "if-none-match": etag } },
      env
    );
    expect(second.status).toBe(304);
  });

  test("GET /v1/search?q=John 6:12-15 NKJV", async () => {
    const res = await app.request(
      "/v1/search?q=John%206:12-15%20NKJV",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.content.length).toBeGreaterThan(0);
  });

  test("GET /v1/search?q=JHN.21.25-ACT.1.3", async () => {
    const res = await app.request(
      "/v1/search?q=JHN.21.25-ACT.1.3",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.content.length).toBeGreaterThan(0);
  });

  test("GET /v1/search?q=bad", async () => {
    const res = await app.request(
      "/v1/search?q=bad",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_SEARCH_QUERY");
  });

  test("GET /v1/votd", async () => {
    const res = await app.request(
      "/v1/votd",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("GEN.1.1");
  });

  test("GET /v1/votd?timezone=Australia/Sydney", async () => {
    const res = await app.request(
      "/v1/votd?timezone=Australia%2FSydney",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBeDefined();
    expect(body.meta.timezone).toBe("Australia/Sydney");
  });

  test("GET /v1/votd?timezone=Not/AZone", async () => {
    const res = await app.request(
      "/v1/votd?timezone=Not%2FAZone",
      { headers: { "api-key": env.API_KEY } },
      env
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TIMEZONE");
  });

  test("timezone-localized VOTD shifts by local date", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-01T01:00:00.000Z"));

      const sydneyRes = await app.request(
        "/v1/votd?timezone=Australia%2FSydney",
        { headers: { "api-key": env.API_KEY } },
        env
      );
      const nyRes = await app.request(
        "/v1/votd?timezone=America%2FNew_York",
        { headers: { "api-key": env.API_KEY } },
        env
      );

      expect(sydneyRes.status).toBe(200);
      expect(nyRes.status).toBe(200);

      const sydneyBody = await sydneyRes.json();
      const nyBody = await nyRes.json();

      expect(sydneyBody.meta.localDate).toBe("2026-03-01");
      expect(nyBody.meta.localDate).toBe("2026-02-28");

      vi.setSystemTime(new Date("2026-03-02T01:00:00.000Z"));
      const nyNextDayRes = await app.request(
        "/v1/votd?timezone=America%2FNew_York",
        { headers: { "api-key": env.API_KEY } },
        env
      );
      expect(nyNextDayRes.status).toBe(200);
      const nyNextDayBody = await nyNextDayRes.json();

      expect(nyNextDayBody.meta.localDate).toBe("2026-03-01");
      expect(nyNextDayBody.data.id).toBe(sydneyBody.data.id);
    } finally {
      vi.useRealTimers();
    }
  });

  test("GET /openapi.json", async () => {
    const res = await app.request("/openapi.json", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paths["/v1/bibles"]).toBeDefined();
  });

  test("GET /docs", async () => {
    const res = await app.request("/docs", {}, env);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("swagger-ui");
  });
});
