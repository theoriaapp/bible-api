import { describe, expect, test } from "vitest";

const BASE_URL =
  process.env.BASE_URL ?? "https://bible-api.theoria-app.workers.dev";
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY is required for production tests.");
}
const apiKey: string = API_KEY;

function buildUrl(path: string) {
  const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function get(path: string) {
  const res = await fetch(buildUrl(path), {
    headers: new Headers({ "api-key": apiKey })
  });
  return res;
}

describe("API (prod)", () => {
  test("GET /v1/bibles", async () => {
    const res = await get("/v1/bibles");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /v1/bibles/NKJV/books", async () => {
    const res = await get("/v1/bibles/NKJV/books");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("GET /v1/bibles/NKJV/chapters/GEN.1", async () => {
    const res = await get("/v1/bibles/NKJV/chapters/GEN.1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.content)).toBe(true);
  });

  test("GET /v1/bibles/NKJV/passages/GEN.1.1-GEN.1.5", async () => {
    const res = await get("/v1/bibles/NKJV/passages/GEN.1.1-GEN.1.5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.content)).toBe(true);
  });

  test("GET /v1/votd", async () => {
    const res = await get("/v1/votd");
    expect([200, 404]).toContain(res.status);
  });

  test("GET /openapi.json", async () => {
    const res = await fetch(buildUrl("/openapi.json"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.paths["/v1/bibles"]).toBeDefined();
  });

  test("GET /docs", async () => {
    const res = await fetch(buildUrl("/docs"));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("swagger-ui");
  });
});
