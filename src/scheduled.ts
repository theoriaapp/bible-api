import topVerses from "../top1000_verses.json";
import { resolveBookId } from "./mappings.js";

type Env = {
  BIBLE_BUCKET: R2Bucket;
  BIBLE_KV: KVNamespace;
};

export async function scheduled(
  _event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
) {
  ctx.waitUntil(runVotd(env));
}

async function runVotd(env: Env) {
  const entries = topVerses as Array<{
    reference: string;
    rank?: number;
    text?: string;
    translation?: string;
  }>;
  if (!entries.length) return;

  const entry = entries[Math.floor(Math.random() * entries.length)];
  const reference = entry.reference?.trim();
  if (!reference) return;

  const parsed = parseReference(reference);
  if (!parsed) return;

  const key = `NKJV/${parsed.bookId}/${parsed.chapter}.json`;
  const obj = await env.BIBLE_BUCKET.get(key);
  if (!obj) return;

  const data = (await obj.json()) as {
    data?: { content?: Array<{ id: string; text: string }> };
  };

  const verses = data?.data?.content ?? [];
  const verseId = `${parsed.bookId}.${parsed.chapter}.${parsed.verse}`;
  const verse = verses.find((item) => item.id === verseId);
  if (!verse) return;

  const payload = {
    data: {
      ...verse,
      bibleId: "NKJV",
      bookId: parsed.bookId,
      chapter: parsed.chapter
    },
    meta: {}
  };

  await env.BIBLE_KV.put("current_votd", JSON.stringify(payload));
}

function parseReference(reference: string) {
  const match = reference.match(/^(.+?)\s+(\d+)(?::([\d-]+))?$/);
  if (!match) return null;

  const bookName = match[1].trim();
  const bookId = resolveBookId(bookName);
  if (!bookId) return null;

  const chapter = match[2];
  const versePart = match[3] ?? "1";
  const verse = versePart.split("-")[0];

  return { bookId, chapter, verse };
}
