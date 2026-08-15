import "dotenv/config";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { buildBundle, type BundleVerse } from "./bundle.js";
import { BOOKS, bookNameToId } from "./mappings.js";

const BUNDLE_ONLY = process.argv.includes("--bundle-only");

const XML_URL =
  "https://raw.githubusercontent.com/rwev/bible/refs/heads/master/bible/translations/NKJV.xml";

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  throw new Error(
    "Missing R2 env vars. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME."
  );
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  trimValues: true
});

const ensureArray = <T>(value: T | T[] | undefined): T[] => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

async function uploadJson(key: string, payload: unknown) {
  const body = JSON.stringify(payload);
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: "application/json"
    })
  );
}

async function seed() {
  console.log("Downloading NKJV XML...");
  const { data: xml } = await axios.get(XML_URL, { responseType: "text" });

  console.log("Parsing XML...");
  const parsed = parser.parse(xml) as {
    bible?: { b?: Array<{ n?: string; c?: any }> | { n?: string; c?: any } };
  };

  const books = ensureArray(parsed.bible?.b);
  if (!books.length) {
    throw new Error("No books found in XML.");
  }

  const chapterMap = new Map<string, BundleVerse[]>();
  for (const book of books) {
    const bookName = book?.n?.trim();
    if (!bookName) continue;

    const bookId = bookNameToId.get(bookName);
    if (!bookId) {
      console.warn(`Skipping unmapped book: ${bookName}`);
      continue;
    }

    const chapters = ensureArray(book.c);
    for (const chapter of chapters) {
      const chapterNumber = String(chapter?.n ?? "").trim();
      if (!chapterNumber) continue;

      const verses = ensureArray(chapter?.v);
      const content = verses
        .map((verse) => {
          if (!verse) return null;
          const verseNumber =
            typeof verse === "string" ? "" : String(verse.n ?? "").trim();
          const verseText =
            typeof verse === "string"
              ? verse.trim()
              : String(verse.text ?? "").trim();
          if (!verseNumber || !verseText) return null;
          return {
            id: `${bookId}.${chapterNumber}.${verseNumber}`,
            text: verseText
          };
        })
        .filter(Boolean);

      const chapterId = `${bookId}.${chapterNumber}`;
      chapterMap.set(`${bookId}/${chapterNumber}`, content as BundleVerse[]);
      if (BUNDLE_ONLY) continue;

      const payload = {
        data: {
          id: chapterId,
          bibleId: "NKJV",
          content
        },
        meta: {}
      };

      const key = `NKJV/${bookId}/${chapterNumber}.json`;
      await uploadJson(key, payload);
      console.log(`Uploaded ${key}`);
    }
  }

  if (!BUNDLE_ONLY) {
    console.log("Uploading books manifest...");
    const booksPayload = {
      data: BOOKS.map((book) => ({
        id: book.id,
        name: book.name,
        abbreviation: book.id,
        chapters: book.chapters
      })),
      meta: {}
    };
    await uploadJson("NKJV/books.json", booksPayload);
  }

  console.log("Uploading offline bundle...");
  const bundle = buildBundle({
    bibleId: "NKJV",
    books: BOOKS,
    chapters: chapterMap
  });
  await uploadJson("NKJV/bundle.json", bundle);
  console.log(`Bundle revision: ${bundle.data.revision}`);

  console.log("Done.");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
