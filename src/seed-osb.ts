import "dotenv/config";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { buildBundle } from "./bundle.js";
import { OSB_BOOKS } from "./mappings.js";

/**
 * Seeds the Orthodox Study Bible from a local SQLite export (osb.db) into R2.
 *
 * Usage:
 *   npm run seed:osb                        # uploads to R2 (needs R2 env vars)
 *   npm run seed:osb -- --dry-run           # writes JSON files to ./osb-out instead
 *   npm run seed:osb -- --db /path/to/osb.db --out /tmp/osb-out --dry-run
 *
 * R2 layout produced:
 *   OSB/books.json                 book manifest (with testament: OT | NT | DC)
 *   OSB/{BOOK}/{chapter}.json      chapter text, same shape as NKJV chapters
 *   OSB/notes/{BOOK}/{chapter}.json  study notes anchored within the chapter
 *   OSB/notes/{BOOK}/intro.json    book introduction (Author, Date, Themes, ...)
 */

const BIBLE_ID = "OSB";

// The db uses NAH for Nahum; the API's canonical USFM-style code is NAM.
const BOOK_CODE_REMAP: Record<string, string> = { NAH: "NAM" };

// Document order of the 76 book-introduction blocks in the OSB EPUB. Blocks are
// detected by rows starting with "Author"; four intro sections carry two books
// back to back (PSA+JOB, OBA+JON, ISA+JER, LAM+LJE) and Susanna / Bel and the
// Dragon have no intro of their own (they are covered by Daniel's).
const INTRO_BOOK_ORDER = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
  "1KI", "2KI", "1CH", "2CH", "1ES", "EZR", "NEH", "TOB", "JDT", "EST",
  "1MA", "2MA", "3MA", "PSA", "JOB", "PRO", "ECC", "SNG", "WIS", "SIR",
  "HOS", "AMO", "MIC", "JOL", "OBA", "JON", "NAM", "HAB", "ZEP", "HAG",
  "ZEC", "MAL", "ISA", "JER", "BAR", "LAM", "LJE", "EZK", "DAN", "MAT",
  "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP",
  "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE",
  "2PE", "1JN", "2JN", "3JN", "JUD", "REV"
];

type StudyNote = {
  id: string;
  type: string;
  verseId: string | null;
  text: string;
  sequence: number;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    db: process.env.OSB_DB_PATH ?? join(homedir(), "Downloads", "osb.db"),
    out: "osb-out",
    dryRun: false,
    bundleOnly: false
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--db") opts.db = args[++i];
    else if (args[i] === "--out") opts.out = args[++i];
    else if (args[i] === "--dry-run") opts.dryRun = true;
    else if (args[i] === "--bundle-only") opts.bundleOnly = true;
  }
  return opts;
}

function remapBook(code: string): string {
  return BOOK_CODE_REMAP[code] ?? code;
}

// "GEN-1-28" -> { bookId: "GEN", chapter: 1, verse: 28 }; book codes never
// contain dashes, so a plain split is safe.
function splitVerseRef(ref: string) {
  const [book, chapter, verse] = ref.split("-");
  return { bookId: remapBook(book), chapter: Number(chapter), verse: Number(verse) };
}

// EPUB extraction artifacts:
// 1. Letter-spaced headings: "T H E  H O L Y  T R I N I T Y" -> "THE HOLY TRINITY"
// 2. Drop caps split off the first letter: "T he center" -> "The center",
//    "“ W e believe" -> "“We believe".
function collapseSpacedCaps(text: string): string {
  if (/[a-z]/.test(text)) return text;
  const words = text.split(/\s{2,}/);
  const isSpaced = words.every((word) => /^(?:\S )+\S$/.test(word));
  if (!isSpaced) return text;
  return words.map((word) => word.replace(/ /g, "")).join(" ");
}

const TWO_LETTER_WORDS = new Set([
  "am", "an", "as", "at", "ah", "aw", "ax", "ay", "be", "by", "do", "go",
  "he", "hi", "if", "in", "is", "it", "me", "my", "no", "of", "oh", "on",
  "or", "ox", "so", "to", "up", "us", "we"
]);

function fixDropCap(text: string): string {
  const match = text.match(/^(["“”'‘’]?)\s*([A-Z]) ([a-z]+)([\s\S]*)$/);
  if (!match) return text;
  const [, quote, capital, fragment, rest] = match;
  const ambiguous = capital === "A" || capital === "I" || capital === "O";
  const fragmentLooksLikeWord =
    fragment.length > 2
      ? !/^([b-df-hj-np-tv-z])\1/.test(fragment)
      : TWO_LETTER_WORDS.has(fragment);
  if (ambiguous && fragmentLooksLikeWord) return text;
  return `${quote}${capital}${fragment}${rest}`;
}

function cleanNoteText(text: string): string {
  const trimmed = text.replace(/\s+$/g, "").replace(/^\s+/g, "");
  return fixDropCap(collapseSpacedCaps(trimmed));
}

async function main() {
  const opts = parseArgs();
  const db = new DatabaseSync(resolve(opts.db), { readOnly: true });

  const uploads: Array<{ key: string; payload: unknown }> = [];

  // --- Chapters ---------------------------------------------------------
  const verseRows = db
    .prepare(
      `SELECT c.book_ref AS book, c.number AS chapter, v.number AS verse, v.text AS text
       FROM verses v
       JOIN chapters c ON v.chapter_ref = c.ref
       JOIN books b ON c.book_ref = b.ref
       ORDER BY b.osb_order, c.number, v.number`
    )
    .all() as Array<{ book: string; chapter: number; verse: number; text: string }>;

  const chapterMap = new Map<string, Array<{ id: string; text: string }>>();
  for (const row of verseRows) {
    const bookId = remapBook(row.book);
    const key = `${bookId}/${row.chapter}`;
    let content = chapterMap.get(key);
    if (!content) {
      content = [];
      chapterMap.set(key, content);
    }
    content.push({
      id: `${bookId}.${row.chapter}.${row.verse}`,
      text: row.text.trim()
    });
  }

  for (const [key, content] of chapterMap) {
    const [bookId, chapter] = key.split("/");
    uploads.push({
      key: `${BIBLE_ID}/${bookId}/${chapter}.json`,
      payload: {
        data: {
          id: `${bookId}.${chapter}`,
          bibleId: BIBLE_ID,
          content
        },
        meta: {}
      }
    });
  }

  // --- Study notes ------------------------------------------------------
  const noteRows = db
    .prepare(
      `SELECT id, verse_ref, note_type, note_text FROM commentary ORDER BY id`
    )
    .all() as Array<{
    id: number;
    verse_ref: string | null;
    note_type: string;
    note_text: string;
  }>;

  // Chapter-anchored notes, grouped by book/chapter in document order.
  const chapterNotes = new Map<string, StudyNote[]>();
  for (const row of noteRows) {
    if (!row.verse_ref) continue;
    const ref = splitVerseRef(row.verse_ref);
    const key = `${ref.bookId}/${ref.chapter}`;
    let notes = chapterNotes.get(key);
    if (!notes) {
      notes = [];
      chapterNotes.set(key, notes);
    }
    notes.push({
      id: `n${row.id}`,
      type: row.note_type,
      verseId: `${ref.bookId}.${ref.chapter}.${ref.verse}`,
      text: cleanNoteText(row.note_text),
      sequence: notes.length + 1
    });
  }

  for (const [key, notes] of chapterNotes) {
    const [bookId, chapter] = key.split("/");
    uploads.push({
      key: `${BIBLE_ID}/notes/${bookId}/${chapter}.json`,
      payload: {
        data: {
          id: `${bookId}.${chapter}`,
          bibleId: BIBLE_ID,
          notes
        },
        meta: {}
      }
    });
  }

  // Unanchored notes are book introductions (plus a few intro-article
  // paragraphs). They appear in document order; a new book's block starts at a
  // row whose text starts with "Author".
  const unanchored = noteRows.filter((row) => !row.verse_ref);
  const blocks: Array<Array<(typeof noteRows)[number]>> = [];
  for (const row of unanchored) {
    if (/^Authors? /.test(row.note_text.trim()) || blocks.length === 0) {
      blocks.push([]);
    }
    blocks[blocks.length - 1].push(row);
  }

  if (blocks.length !== INTRO_BOOK_ORDER.length) {
    throw new Error(
      `Expected ${INTRO_BOOK_ORDER.length} intro blocks, found ${blocks.length}. ` +
        "The osb.db layout changed; update INTRO_BOOK_ORDER."
    );
  }

  const introSummary: string[] = [];
  const introNotes = new Map<string, StudyNote[]>();
  blocks.forEach((block, index) => {
    const bookId = INTRO_BOOK_ORDER[index];
    const notes: StudyNote[] = block.map((row, noteIndex) => ({
      id: `n${row.id}`,
      type: row.note_type,
      verseId: null,
      text: cleanNoteText(row.note_text),
      sequence: noteIndex + 1
    }));
    introNotes.set(bookId, notes);
    introSummary.push(
      `${bookId}: ${notes.length} notes (${notes[0].text.slice(0, 60)}...)`
    );
    uploads.push({
      key: `${BIBLE_ID}/notes/${bookId}/intro.json`,
      payload: {
        data: {
          bookId,
          bibleId: BIBLE_ID,
          notes
        },
        meta: {}
      }
    });
  });

  // --- Books manifest ---------------------------------------------------
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

  // --- Offline bundle ---------------------------------------------------
  const bundle = buildBundle({
    bibleId: BIBLE_ID,
    books: OSB_BOOKS,
    chapters: chapterMap,
    chapterNotes,
    introNotes
  });
  uploads.push({ key: `${BIBLE_ID}/bundle.json`, payload: bundle });
  console.log(`Bundle revision: ${bundle.data.revision}`);

  // --- Validate against the registry ------------------------------------
  const chapterCounts = new Map<string, number>();
  for (const key of chapterMap.keys()) {
    const [bookId] = key.split("/");
    chapterCounts.set(bookId, (chapterCounts.get(bookId) ?? 0) + 1);
  }
  for (const book of OSB_BOOKS) {
    const actual = chapterCounts.get(book.id) ?? 0;
    if (actual !== book.chapters) {
      throw new Error(
        `Chapter count mismatch for ${book.id}: registry says ${book.chapters}, db has ${actual}.`
      );
    }
  }

  const totalVerses = verseRows.length;
  const totalChapterNotes = [...chapterNotes.values()].reduce(
    (sum, notes) => sum + notes.length,
    0
  );
  const totalIntroNotes = unanchored.length;
  console.log(
    `Prepared ${uploads.length} objects: ${chapterMap.size} chapters (${totalVerses} verses), ` +
      `${chapterNotes.size} chapter note files (${totalChapterNotes} notes), ` +
      `${blocks.length} book intros (${totalIntroNotes} notes).`
  );
  console.log("\nBook intro assignment:");
  for (const line of introSummary) console.log(`  ${line}`);

  // --- Write ------------------------------------------------------------
  const toWrite = opts.bundleOnly
    ? uploads.filter((upload) => upload.key === `${BIBLE_ID}/bundle.json`)
    : uploads;

  if (opts.dryRun) {
    const outDir = resolve(opts.out);
    for (const { key, payload } of toWrite) {
      const filePath = join(outDir, key);
      mkdirSync(join(filePath, ".."), { recursive: true });
      writeFileSync(filePath, JSON.stringify(payload, null, 2));
    }
    console.log(`\nDry run: wrote ${toWrite.length} files under ${outDir}.`);
    return;
  }

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Missing R2 env vars. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME (or use --dry-run)."
    );
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });

  let uploaded = 0;
  for (const { key, payload } of toWrite) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(payload),
        ContentType: "application/json"
      })
    );
    uploaded += 1;
    if (uploaded % 100 === 0) {
      console.log(`Uploaded ${uploaded}/${toWrite.length}...`);
    }
  }
  console.log(`Done. Uploaded ${uploaded} objects.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
