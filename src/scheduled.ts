import { BOOKS } from "./mappings.js";

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
  const book = BOOKS[Math.floor(Math.random() * BOOKS.length)];
  const chapter = Math.floor(Math.random() * book.chapters) + 1;
  const key = `NKJV/${book.id}/${chapter}.json`;

  const obj = await env.BIBLE_BUCKET.get(key);
  if (!obj) return;

  const data = (await obj.json()) as {
    data?: { content?: Array<{ id: string; text: string }> };
  };

  const verses = data?.data?.content ?? [];
  if (!verses.length) return;

  const verse = verses[Math.floor(Math.random() * verses.length)];

  const payload = {
    data: {
      ...verse,
      bibleId: "NKJV",
      bookId: book.id,
      chapter: String(chapter)
    },
    meta: {}
  };

  await env.BIBLE_KV.put("current_votd", JSON.stringify(payload));
}
