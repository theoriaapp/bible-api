import "dotenv/config";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { buildBundle, type BundleNote, type BundleVerse } from "./bundle.js";
import { OSB_BOOKS } from "./mappings.js";

/**
 * Seeds the Orthodox Study Bible from the Thomas Nelson EPUB extraction
 * (authoritative source) into R2, replacing the osb.db-derived data that
 * seed-osb.ts produced. Two extraction artifacts feed it:
 *
 *   --verses <epub-verses.json>   { "GEN.1.1": "In the beginning...", ... }
 *   --notes-dir <dir>             <CODE>.json per book:
 *     [{ kind: "study"|"heading"|"article"|"intro"|"lectionary",
 *        ref: "GEN-1-31" | null, label: "1:31" | null,
 *        title: "Creation" | null, text: "...\n\n..." }]
 *
 * R2 layout written (same as seed-osb.ts):
 *   OSB/books.json, OSB/{BOOK}/{ch}.json, OSB/notes/{BOOK}/{ch}.json,
 *   OSB/notes/{BOOK}/intro.json, OSB/bundle.json
 *
 * Chapter note ordering follows the print apparatus: pericope heading, then
 * study notes, then lectionary notes, then boxed articles, by anchor verse.
 * Study/lectionary notes carry `label` (the printed ref, e.g. "4:7, 8") which
 * clients render as a leading crimson ref.
 */

const BIBLE_ID = "OSB";

type ExtractedNote = {
  kind: "study" | "heading" | "article" | "intro" | "lectionary";
  ref: string | null;
  label: string | null;
  title: string | null;
  text: string;
};

// BundleNote plus the printed ref label (optional, additive for clients).
type SeedNote = BundleNote & { label?: string };

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    verses: "",
    notesDir: "",
    out: "osb-epub-out",
    dryRun: false
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--verses") opts.verses = args[++i];
    else if (args[i] === "--notes-dir") opts.notesDir = args[++i];
    else if (args[i] === "--out") opts.out = args[++i];
    else if (args[i] === "--dry-run") opts.dryRun = true;
  }
  if (!opts.verses || !opts.notesDir) {
    throw new Error("Usage: seed-osb-epub --verses <epub-verses.json> --notes-dir <dir> [--dry-run] [--out <dir>]");
  }
  return opts;
}

// "GEN-1-31" -> { bookId, chapter, verse }
function splitRef(ref: string) {
  const [bookId, chapter, verse] = ref.split("-");
  return { bookId, chapter: Number(chapter), verse: Number(verse) };
}

const KIND_ORDER: Record<string, number> = {
  heading: 0,
  study: 1,
  lectionary: 2,
  article: 3
};

async function main() {
  const opts = parseArgs();
  const bookIds = new Set(OSB_BOOKS.map((b) => b.id));

  // --- Verses -------------------------------------------------------------
  const verseMap = JSON.parse(readFileSync(resolve(opts.verses), "utf8")) as Record<string, string>;
  const chapterMap = new Map<string, BundleVerse[]>(); // "BOOK/ch"
  let verseCount = 0;
  for (const [id, text] of Object.entries(verseMap)) {
    const [bookId, chapter, verse] = id.split(".");
    if (!bookIds.has(bookId)) throw new Error(`Verse ${id}: unknown book ${bookId}`);
    const cleaned = cleanVerseText(text);
    if (!cleaned) throw new Error(`Verse ${id}: empty text`);
    const key = `${bookId}/${chapter}`;
    let content = chapterMap.get(key);
    if (!content) {
      content = [];
      chapterMap.set(key, content);
    }
    content.push({ id, text: cleaned, verse: Number(verse) } as BundleVerse & { verse: number });
    verseCount += 1;
  }
  // Verse order within a chapter follows verse number, not JSON key order.
  for (const content of chapterMap.values()) {
    (content as Array<BundleVerse & { verse: number }>).sort((a, b) => a.verse - b.verse);
    for (const v of content as Array<BundleVerse & { verse?: number }>) delete v.verse;
  }

  // --- Notes ---------------------------------------------------------------
  const chapterNotes = new Map<string, SeedNote[]>(); // "BOOK/ch"
  const introNotes = new Map<string, SeedNote[]>(); // "BOOK"
  const counts = { study: 0, heading: 0, lectionary: 0, article: 0, intro: 0 };

  const noteFiles = readdirSync(resolve(opts.notesDir)).filter((f) => f.endsWith(".json"));
  for (const file of noteFiles) {
    const bookId = file.replace(/\.json$/, "");
    if (!bookIds.has(bookId)) throw new Error(`Notes file ${file}: unknown book`);
    const entries = JSON.parse(readFileSync(join(resolve(opts.notesDir), file), "utf8")) as ExtractedNote[];

    // Collect per chapter first, then order like the print apparatus.
    const perChapter = new Map<number, Array<ExtractedNote & { verse: number; docIndex: number }>>();
    for (const [docIndex, entry] of entries.entries()) {
      if (entry.kind === "intro") {
        introNotes.set(bookId, introToNotes(bookId, entry));
        counts.intro += 1;
        continue;
      }
      if (!entry.ref) throw new Error(`${bookId}: ${entry.kind} without ref (title=${entry.title ?? "-"})`);
      const { bookId: refBook, chapter, verse } = splitRef(entry.ref);
      if (refBook !== bookId) throw new Error(`${file}: ref ${entry.ref} in wrong book`);
      if (!chapterMap.has(`${bookId}/${chapter}`)) {
        throw new Error(`${bookId}: note ref ${entry.ref} points at a chapter with no verses`);
      }
      let list = perChapter.get(chapter);
      if (!list) {
        list = [];
        perChapter.set(chapter, list);
      }
      list.push({ ...entry, verse, docIndex });
      counts[entry.kind] += 1;
    }

    for (const [chapter, list] of perChapter) {
      list.sort(
        (a, b) =>
          a.verse - b.verse ||
          (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
          a.docIndex - b.docIndex
      );
      const notes: SeedNote[] = [];
      for (const entry of list) {
        const verseId = `${bookId}.${chapter}.${entry.verse}`;
        if (entry.kind === "heading") {
          notes.push(note(bookId, chapter, notes.length, "sidebar", verseId,
            entry.title! + (entry.text ? ` ${entry.text}` : "")));
        } else if (entry.kind === "article") {
          // Boxed article: its title as a heading, body paragraphs as prose.
          notes.push(note(bookId, chapter, notes.length, "sidebar", verseId, entry.title ?? "Article"));
          for (const para of paragraphs(entry.text)) {
            notes.push(note(bookId, chapter, notes.length, "article", verseId, para));
          }
        } else {
          const n = note(bookId, chapter, notes.length, entry.kind, verseId, entry.text);
          if (entry.label) n.label = entry.label;
          notes.push(n);
        }
      }
      chapterNotes.set(`${bookId}/${chapter}`, notes);
    }
  }

  // --- Assemble uploads -----------------------------------------------------
  const uploads: Array<{ key: string; payload: unknown }> = [];

  for (const [key, content] of chapterMap) {
    const [bookId, chapter] = key.split("/");
    uploads.push({
      key: `${BIBLE_ID}/${bookId}/${chapter}.json`,
      payload: { data: { id: `${bookId}.${chapter}`, bibleId: BIBLE_ID, content }, meta: {} }
    });
  }
  for (const [key, notes] of chapterNotes) {
    const [bookId, chapter] = key.split("/");
    uploads.push({
      key: `${BIBLE_ID}/notes/${bookId}/${chapter}.json`,
      payload: { data: { id: `${bookId}.${chapter}`, bibleId: BIBLE_ID, notes }, meta: {} }
    });
  }
  for (const [bookId, notes] of introNotes) {
    uploads.push({
      key: `${BIBLE_ID}/notes/${bookId}/intro.json`,
      payload: { data: { bookId, bibleId: BIBLE_ID, notes }, meta: {} }
    });
  }
  uploads.push({
    key: `${BIBLE_ID}/books.json`,
    payload: {
      data: OSB_BOOKS.map((book) => ({
        id: book.id,
        name: book.name,
        abbreviation: book.id,
        chapters: book.chapters,
        testament: book.testament
      })),
      meta: {}
    }
  });

  const bundle = buildBundle({
    bibleId: BIBLE_ID,
    books: OSB_BOOKS,
    chapters: chapterMap,
    chapterNotes,
    introNotes
  });
  uploads.push({ key: `${BIBLE_ID}/bundle.json`, payload: bundle });

  // --- Validate -------------------------------------------------------------
  const chapterCounts = new Map<string, number>();
  for (const key of chapterMap.keys()) {
    const [bookId] = key.split("/");
    chapterCounts.set(bookId, (chapterCounts.get(bookId) ?? 0) + 1);
  }
  for (const book of OSB_BOOKS) {
    const actual = chapterCounts.get(book.id) ?? 0;
    if (actual !== book.chapters) {
      throw new Error(`Chapter count mismatch for ${book.id}: registry ${book.chapters}, extraction ${actual}.`);
    }
  }

  const totalChapterNotes = [...chapterNotes.values()].reduce((s, n) => s + n.length, 0);
  console.log(`Bundle revision: ${bundle.data.revision}`);
  console.log(
    `Prepared ${uploads.length} objects: ${chapterMap.size} chapters (${verseCount} verses), ` +
      `${chapterNotes.size} chapter note files (${totalChapterNotes} notes), ${introNotes.size} book intros.`
  );
  console.log(
    `Apparatus: ${counts.study} study, ${counts.heading} headings, ${counts.lectionary} lectionary, ` +
      `${counts.article} articles, ${counts.intro} intros.`
  );

  // --- Write -----------------------------------------------------------------
  if (opts.dryRun) {
    const outDir = resolve(opts.out);
    for (const { key, payload } of uploads) {
      const filePath = join(outDir, key);
      mkdirSync(join(filePath, ".."), { recursive: true });
      writeFileSync(filePath, JSON.stringify(payload, null, 2));
    }
    console.log(`\nDry run: wrote ${uploads.length} files under ${outDir}.`);
    return;
  }

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing R2 env vars. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME (or use --dry-run).");
  }
  const s3 = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
  let uploaded = 0;
  const CONCURRENCY = 25;
  for (let i = 0; i < uploads.length; i += CONCURRENCY) {
    await Promise.all(
      uploads.slice(i, i + CONCURRENCY).map(({ key, payload }) =>
        s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: JSON.stringify(payload),
            ContentType: "application/json"
          })
        )
      )
    );
    uploaded = Math.min(i + CONCURRENCY, uploads.length);
    if (uploaded % 500 < CONCURRENCY) console.log(`Uploaded ${uploaded}/${uploads.length}...`);
  }
  console.log(`Done. Uploaded ${uploaded} objects.`);
}

function note(bookId: string, chapter: number, index: number, type: string, verseId: string, text: string): SeedNote {
  return { id: `${bookId}.${chapter}.n${index + 1}`, type, verseId, text, sequence: index + 1 };
}

// Book intros keep their print structure: short un-punctuated lines
// ("Author", "Date", "Major Theme") become sidebar headings.
function introToNotes(bookId: string, entry: ExtractedNote): SeedNote[] {
  const notes: SeedNote[] = [];
  for (const para of paragraphs(entry.text)) {
    const isHeading = para.length <= 48 && !/[.!?:;]$/.test(para) && !/\n/.test(para);
    notes.push({
      id: `${bookId}.intro.n${notes.length + 1}`,
      type: isHeading ? "sidebar" : "intro",
      verseId: null,
      text: para,
      sequence: notes.length + 1
    });
  }
  return notes;
}

// The EPUB carries typesetting artifacts: stray spaces before closing
// punctuation ("Tamar , Perez"). No spaced ellipses exist in the verse text,
// so collapsing is safe (verified against the full extraction).
function cleanVerseText(text: string): string {
  return text
    .replace(/ /g, " ")
    .replace(/\s+([,;:.!?”’»)\]])/g, "$1")
    .replace(/([“‘(\[])\s+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
