import { createHash } from "node:crypto";
import type { Book } from "./mappings.js";

/**
 * Offline bundle: one JSON object per bible containing the complete text (and
 * study notes where available), using the same shapes as the online API so
 * client rendering code works identically online and offline.
 *
 * Stored at R2 key `{BIBLE_ID}/bundle.json` and served by
 * GET /v1/bibles/:bibleId/download. `revision` is a content hash — clients
 * re-download only when it (or the response ETag) changes.
 */

export type BundleVerse = { id: string; text: string };

export type BundleNote = {
  id: string;
  type: string;
  verseId: string | null;
  text: string;
  sequence: number;
};

export type BibleBundle = {
  data: {
    bibleId: string;
    revision: string;
    books: Array<{
      id: string;
      name: string;
      abbreviation: string;
      chapters: number;
      testament?: string;
    }>;
    chapters: Record<string, BundleVerse[]>;
    notes?: {
      chapters: Record<string, BundleNote[]>;
      intros: Record<string, BundleNote[]>;
    };
  };
  meta: { generatedAt: string };
};

export function buildBundle(input: {
  bibleId: string;
  books: Book[];
  chapters: Map<string, BundleVerse[]>; // key: "BOOK/chapter"
  chapterNotes?: Map<string, BundleNote[]>; // key: "BOOK/chapter"
  introNotes?: Map<string, BundleNote[]>; // key: "BOOK"
}): BibleBundle {
  const chapters: Record<string, BundleVerse[]> = {};
  for (const [key, content] of input.chapters) {
    chapters[key.replace("/", ".")] = content;
  }

  const data: BibleBundle["data"] = {
    bibleId: input.bibleId,
    revision: "",
    books: input.books.map((book) => ({
      id: book.id,
      name: book.name,
      abbreviation: book.id,
      chapters: book.chapters,
      ...(book.testament ? { testament: book.testament } : {})
    })),
    chapters
  };

  if (input.chapterNotes || input.introNotes) {
    const noteChapters: Record<string, BundleNote[]> = {};
    for (const [key, notes] of input.chapterNotes ?? []) {
      noteChapters[key.replace("/", ".")] = notes;
    }
    const intros: Record<string, BundleNote[]> = {};
    for (const [bookId, notes] of input.introNotes ?? []) {
      intros[bookId] = notes;
    }
    data.notes = { chapters: noteChapters, intros };
  }

  data.revision = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .slice(0, 16);

  return { data, meta: { generatedAt: new Date().toISOString() } };
}
