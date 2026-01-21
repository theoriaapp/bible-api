import { describe, expect, test, vi } from "vitest";
import type {
  ExecutionContext,
  KVNamespace,
  R2Bucket,
  ScheduledEvent
} from "@cloudflare/workers-types";
import entry from "../src/index.js";

type R2Object = {
  json: () => Promise<unknown>;
};

function createMockR2(data: Record<string, unknown>) {
  return {
    get: async (key: string) => {
      const payload = data[key];
      if (!payload) return null;
      return { json: async () => payload } as R2Object;
    }
  } as unknown as R2Bucket;
}

function createMockKv() {
  const store: { value?: string } = {};
  const kv = {
    put: async (_key: string, value: string) => {
      store.value = value;
    }
  } as unknown as KVNamespace;

  return { kv, store };
}

describe("scheduled votd", () => {
  test("entry exports scheduled handler", () => {
    expect(typeof entry.scheduled).toBe("function");
  });

  test("resolves top verse reference to NKJV verse", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const { kv, store } = createMockKv();
    const env = {
      BIBLE_BUCKET: createMockR2({
        "NKJV/JHN/3.json": {
          data: {
            content: [{ id: "JHN.3.16", text: "For God so loved the world..." }]
          }
        }
      }),
      BIBLE_KV: kv
    };
    const waitUntil = vi.fn((promise: Promise<void>) => promise);

    await entry.scheduled({} as ScheduledEvent, env as any, {
      waitUntil,
      passThroughOnException: vi.fn(),
      props: {}
    } as ExecutionContext);
    const promise = waitUntil.mock.calls[0]?.[0];
    if (promise) await promise;

    expect(store.value).toBeTruthy();
    const payload = JSON.parse(store.value as string);
    expect(payload.data.id).toBe("JHN.3.16");
    expect(payload.data.text).toBe("For God so loved the world...");
    expect(payload.data.bibleId).toBe("NKJV");
    expect(payload.data.bookId).toBe("JHN");
    expect(payload.data.chapter).toBe("3");

    randomSpy.mockRestore();
  });
});
