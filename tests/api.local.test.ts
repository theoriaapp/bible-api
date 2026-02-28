import { describe, expect, test } from "vitest";
import { app } from "../src/index.js";

type R2Object = {
  body: string;
  httpMetadata?: { contentType?: string };
  json: () => Promise<unknown>;
};

function createR2Object(payload: unknown): R2Object {
  const body = JSON.stringify(payload);
  return {
    body,
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
    expect(body.data[0].id).toBe("NKJV");
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
