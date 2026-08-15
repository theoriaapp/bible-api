export type Testament = "OT" | "NT" | "DC";

export type Book = {
  id: string;
  name: string;
  chapters: number;
  testament?: Testament;
};

export const BOOKS: Book[] = [
  { id: "GEN", name: "Genesis", chapters: 50 },
  { id: "EXO", name: "Exodus", chapters: 40 },
  { id: "LEV", name: "Leviticus", chapters: 27 },
  { id: "NUM", name: "Numbers", chapters: 36 },
  { id: "DEU", name: "Deuteronomy", chapters: 34 },
  { id: "JOS", name: "Joshua", chapters: 24 },
  { id: "JDG", name: "Judges", chapters: 21 },
  { id: "RUT", name: "Ruth", chapters: 4 },
  { id: "1SA", name: "1 Samuel", chapters: 31 },
  { id: "2SA", name: "2 Samuel", chapters: 24 },
  { id: "1KI", name: "1 Kings", chapters: 22 },
  { id: "2KI", name: "2 Kings", chapters: 25 },
  { id: "1CH", name: "1 Chronicles", chapters: 29 },
  { id: "2CH", name: "2 Chronicles", chapters: 36 },
  { id: "EZR", name: "Ezra", chapters: 10 },
  { id: "NEH", name: "Nehemiah", chapters: 13 },
  { id: "EST", name: "Esther", chapters: 10 },
  { id: "JOB", name: "Job", chapters: 42 },
  { id: "PSA", name: "Psalms", chapters: 150 },
  { id: "PRO", name: "Proverbs", chapters: 31 },
  { id: "ECC", name: "Ecclesiastes", chapters: 12 },
  { id: "SNG", name: "Song of Solomon", chapters: 8 },
  { id: "ISA", name: "Isaiah", chapters: 66 },
  { id: "JER", name: "Jeremiah", chapters: 52 },
  { id: "LAM", name: "Lamentations", chapters: 5 },
  { id: "EZK", name: "Ezekiel", chapters: 48 },
  { id: "DAN", name: "Daniel", chapters: 12 },
  { id: "HOS", name: "Hosea", chapters: 14 },
  { id: "JOL", name: "Joel", chapters: 3 },
  { id: "AMO", name: "Amos", chapters: 9 },
  { id: "OBA", name: "Obadiah", chapters: 1 },
  { id: "JON", name: "Jonah", chapters: 4 },
  { id: "MIC", name: "Micah", chapters: 7 },
  { id: "NAM", name: "Nahum", chapters: 3 },
  { id: "HAB", name: "Habakkuk", chapters: 3 },
  { id: "ZEP", name: "Zephaniah", chapters: 3 },
  { id: "HAG", name: "Haggai", chapters: 2 },
  { id: "ZEC", name: "Zechariah", chapters: 14 },
  { id: "MAL", name: "Malachi", chapters: 4 },
  { id: "MAT", name: "Matthew", chapters: 28 },
  { id: "MRK", name: "Mark", chapters: 16 },
  { id: "LUK", name: "Luke", chapters: 24 },
  { id: "JHN", name: "John", chapters: 21 },
  { id: "ACT", name: "Acts", chapters: 28 },
  { id: "ROM", name: "Romans", chapters: 16 },
  { id: "1CO", name: "1 Corinthians", chapters: 16 },
  { id: "2CO", name: "2 Corinthians", chapters: 13 },
  { id: "GAL", name: "Galatians", chapters: 6 },
  { id: "EPH", name: "Ephesians", chapters: 6 },
  { id: "PHP", name: "Philippians", chapters: 4 },
  { id: "COL", name: "Colossians", chapters: 4 },
  { id: "1TH", name: "1 Thessalonians", chapters: 5 },
  { id: "2TH", name: "2 Thessalonians", chapters: 3 },
  { id: "1TI", name: "1 Timothy", chapters: 6 },
  { id: "2TI", name: "2 Timothy", chapters: 4 },
  { id: "TIT", name: "Titus", chapters: 3 },
  { id: "PHM", name: "Philemon", chapters: 1 },
  { id: "HEB", name: "Hebrews", chapters: 13 },
  { id: "JAS", name: "James", chapters: 5 },
  { id: "1PE", name: "1 Peter", chapters: 5 },
  { id: "2PE", name: "2 Peter", chapters: 3 },
  { id: "1JN", name: "1 John", chapters: 5 },
  { id: "2JN", name: "2 John", chapters: 1 },
  { id: "3JN", name: "3 John", chapters: 1 },
  { id: "JUD", name: "Jude", chapters: 1 },
  { id: "REV", name: "Revelation", chapters: 22 }
];

// Orthodox Study Bible: LXX-based Old Testament (Psalms follow Greek numbering
// and include Psalm 151; 2 Chronicles 37 is the Prayer of Manasseh) plus the
// deuterocanonical books. New Testament text is the NKJV.
export const OSB_BOOKS: Book[] = [
  { id: "GEN", name: "Genesis", chapters: 50, testament: "OT" },
  { id: "EXO", name: "Exodus", chapters: 40, testament: "OT" },
  { id: "LEV", name: "Leviticus", chapters: 27, testament: "OT" },
  { id: "NUM", name: "Numbers", chapters: 36, testament: "OT" },
  { id: "DEU", name: "Deuteronomy", chapters: 34, testament: "OT" },
  { id: "JOS", name: "Joshua", chapters: 24, testament: "OT" },
  { id: "JDG", name: "Judges", chapters: 21, testament: "OT" },
  { id: "RUT", name: "Ruth", chapters: 4, testament: "OT" },
  { id: "1SA", name: "1 Samuel", chapters: 31, testament: "OT" },
  { id: "2SA", name: "2 Samuel", chapters: 24, testament: "OT" },
  { id: "1KI", name: "1 Kings", chapters: 22, testament: "OT" },
  { id: "2KI", name: "2 Kings", chapters: 25, testament: "OT" },
  { id: "1CH", name: "1 Chronicles", chapters: 29, testament: "OT" },
  { id: "2CH", name: "2 Chronicles", chapters: 37, testament: "OT" },
  { id: "EZR", name: "Ezra", chapters: 10, testament: "OT" },
  { id: "NEH", name: "Nehemiah", chapters: 13, testament: "OT" },
  { id: "TOB", name: "Tobit", chapters: 14, testament: "DC" },
  { id: "JDT", name: "Judith", chapters: 16, testament: "DC" },
  { id: "EST", name: "Esther", chapters: 10, testament: "OT" },
  { id: "1MA", name: "1 Maccabees", chapters: 16, testament: "DC" },
  { id: "2MA", name: "2 Maccabees", chapters: 15, testament: "DC" },
  { id: "3MA", name: "3 Maccabees", chapters: 7, testament: "DC" },
  { id: "JOB", name: "Job", chapters: 42, testament: "OT" },
  { id: "PSA", name: "Psalms", chapters: 151, testament: "OT" },
  { id: "PRO", name: "Proverbs", chapters: 31, testament: "OT" },
  { id: "ECC", name: "Ecclesiastes", chapters: 12, testament: "OT" },
  { id: "SNG", name: "Song of Songs", chapters: 8, testament: "OT" },
  { id: "WIS", name: "Wisdom of Solomon", chapters: 19, testament: "DC" },
  { id: "SIR", name: "Sirach", chapters: 51, testament: "DC" },
  { id: "ISA", name: "Isaiah", chapters: 66, testament: "OT" },
  { id: "JER", name: "Jeremiah", chapters: 52, testament: "OT" },
  { id: "LAM", name: "Lamentations", chapters: 5, testament: "OT" },
  { id: "BAR", name: "Baruch", chapters: 5, testament: "DC" },
  { id: "LJE", name: "Letter of Jeremiah", chapters: 1, testament: "DC" },
  { id: "EZK", name: "Ezekiel", chapters: 48, testament: "OT" },
  { id: "DAN", name: "Daniel", chapters: 12, testament: "OT" },
  { id: "SUS", name: "Susanna", chapters: 1, testament: "DC" },
  { id: "BEL", name: "Bel and the Dragon", chapters: 1, testament: "DC" },
  { id: "HOS", name: "Hosea", chapters: 14, testament: "OT" },
  { id: "JOL", name: "Joel", chapters: 4, testament: "OT" },
  { id: "AMO", name: "Amos", chapters: 9, testament: "OT" },
  { id: "OBA", name: "Obadiah", chapters: 1, testament: "OT" },
  { id: "JON", name: "Jonah", chapters: 4, testament: "OT" },
  { id: "MIC", name: "Micah", chapters: 7, testament: "OT" },
  { id: "NAM", name: "Nahum", chapters: 3, testament: "OT" },
  { id: "HAB", name: "Habakkuk", chapters: 3, testament: "OT" },
  { id: "ZEP", name: "Zephaniah", chapters: 3, testament: "OT" },
  { id: "HAG", name: "Haggai", chapters: 2, testament: "OT" },
  { id: "ZEC", name: "Zechariah", chapters: 14, testament: "OT" },
  { id: "MAL", name: "Malachi", chapters: 3, testament: "OT" },
  { id: "1ES", name: "1 Esdras", chapters: 9, testament: "DC" },
  { id: "MAT", name: "Matthew", chapters: 28, testament: "NT" },
  { id: "MRK", name: "Mark", chapters: 16, testament: "NT" },
  { id: "LUK", name: "Luke", chapters: 24, testament: "NT" },
  { id: "JHN", name: "John", chapters: 21, testament: "NT" },
  { id: "ACT", name: "Acts", chapters: 28, testament: "NT" },
  { id: "ROM", name: "Romans", chapters: 16, testament: "NT" },
  { id: "1CO", name: "1 Corinthians", chapters: 16, testament: "NT" },
  { id: "2CO", name: "2 Corinthians", chapters: 13, testament: "NT" },
  { id: "GAL", name: "Galatians", chapters: 6, testament: "NT" },
  { id: "EPH", name: "Ephesians", chapters: 6, testament: "NT" },
  { id: "PHP", name: "Philippians", chapters: 4, testament: "NT" },
  { id: "COL", name: "Colossians", chapters: 4, testament: "NT" },
  { id: "1TH", name: "1 Thessalonians", chapters: 5, testament: "NT" },
  { id: "2TH", name: "2 Thessalonians", chapters: 3, testament: "NT" },
  { id: "1TI", name: "1 Timothy", chapters: 6, testament: "NT" },
  { id: "2TI", name: "2 Timothy", chapters: 4, testament: "NT" },
  { id: "TIT", name: "Titus", chapters: 3, testament: "NT" },
  { id: "PHM", name: "Philemon", chapters: 1, testament: "NT" },
  { id: "HEB", name: "Hebrews", chapters: 13, testament: "NT" },
  { id: "JAS", name: "James", chapters: 5, testament: "NT" },
  { id: "1PE", name: "1 Peter", chapters: 5, testament: "NT" },
  { id: "2PE", name: "2 Peter", chapters: 3, testament: "NT" },
  { id: "1JN", name: "1 John", chapters: 5, testament: "NT" },
  { id: "2JN", name: "2 John", chapters: 1, testament: "NT" },
  { id: "3JN", name: "3 John", chapters: 1, testament: "NT" },
  { id: "JUD", name: "Jude", chapters: 1, testament: "NT" },
  { id: "REV", name: "Revelation", chapters: 22, testament: "NT" }
];

export type BibleFeature = "notes";

export type Bible = {
  id: string;
  name: string;
  abbreviation: string;
  description: string;
  books: Book[];
  features: BibleFeature[];
};

export const BIBLES: Bible[] = [
  {
    id: "NKJV",
    name: "New King James Version",
    abbreviation: "NKJV",
    description: "New King James Version.",
    books: BOOKS,
    features: []
  },
  {
    id: "OSB",
    name: "Orthodox Study Bible",
    abbreviation: "OSB",
    description:
      "Orthodox Study Bible: St. Athanasius Academy Septuagint Old Testament (Greek versification, includes the deuterocanonical books) with the NKJV New Testament, plus study notes.",
    books: OSB_BOOKS,
    features: ["notes"]
  }
];

const bibleById = new Map(BIBLES.map((bible) => [bible.id, bible]));

export function getBible(bibleId: string): Bible | undefined {
  return bibleById.get(bibleId.toUpperCase());
}

const chaptersByBible = new Map(
  BIBLES.map((bible) => [
    bible.id,
    new Map(bible.books.map((book) => [book.id, book.chapters]))
  ])
);

const orderByBible = new Map(
  BIBLES.map((bible) => [
    bible.id,
    new Map(bible.books.map((book, index) => [book.id, index]))
  ])
);

export function chaptersForBook(bible: Bible, bookId: string): number | undefined {
  return chaptersByBible.get(bible.id)?.get(bookId);
}

export function bookOrderIndexFor(bible: Bible, bookId: string): number | undefined {
  return orderByBible.get(bible.id)?.get(bookId);
}

export const bookNameToId = new Map(BOOKS.map((book) => [book.name, book.id]));
export const bookIdToChapters = new Map(
  BOOKS.map((book) => [book.id, book.chapters])
);
export const bookIds = BOOKS.map((book) => book.id);

const bookAliasPairs: Array<[string, string]> = [
  ["GEN", "GEN"],
  ["GE", "GEN"],
  ["GN", "GEN"],
  ["EXO", "EXO"],
  ["EX", "EXO"],
  ["LEV", "LEV"],
  ["LV", "LEV"],
  ["NUM", "NUM"],
  ["NU", "NUM"],
  ["DEU", "DEU"],
  ["DEUT", "DEU"],
  ["DT", "DEU"],
  ["JOS", "JOS"],
  ["JOSH", "JOS"],
  ["JDG", "JDG"],
  ["JUDG", "JDG"],
  ["RUT", "RUT"],
  ["RUTH", "RUT"],
  ["1SA", "1SA"],
  ["1SAM", "1SA"],
  ["2SA", "2SA"],
  ["2SAM", "2SA"],
  ["1KI", "1KI"],
  ["1KGS", "1KI"],
  ["2KI", "2KI"],
  ["2KGS", "2KI"],
  ["1CH", "1CH"],
  ["1CHR", "1CH"],
  ["2CH", "2CH"],
  ["2CHR", "2CH"],
  ["EZR", "EZR"],
  ["NEH", "NEH"],
  ["EST", "EST"],
  ["JOB", "JOB"],
  ["PSA", "PSA"],
  ["PS", "PSA"],
  ["PSM", "PSA"],
  ["PRO", "PRO"],
  ["PR", "PRO"],
  ["ECC", "ECC"],
  ["EC", "ECC"],
  ["SNG", "SNG"],
  ["SONG", "SNG"],
  ["SOS", "SNG"],
  ["ISA", "ISA"],
  ["JER", "JER"],
  ["LAM", "LAM"],
  ["EZK", "EZK"],
  ["EZE", "EZK"],
  ["EZEK", "EZK"],
  ["DAN", "DAN"],
  ["HOS", "HOS"],
  ["JOL", "JOL"],
  ["JOEL", "JOL"],
  ["AMO", "AMO"],
  ["OBA", "OBA"],
  ["JON", "JON"],
  ["MIC", "MIC"],
  ["NAM", "NAM"],
  ["NAH", "NAM"],
  ["HAB", "HAB"],
  ["ZEP", "ZEP"],
  ["ZEPH", "ZEP"],
  ["HAG", "HAG"],
  ["ZEC", "ZEC"],
  ["ZECH", "ZEC"],
  ["MAL", "MAL"],
  ["MAT", "MAT"],
  ["MT", "MAT"],
  ["MRK", "MRK"],
  ["MK", "MRK"],
  ["LUK", "LUK"],
  ["LK", "LUK"],
  ["JHN", "JHN"],
  ["JN", "JHN"],
  ["JOH", "JHN"],
  ["JOHN", "JHN"],
  ["ACT", "ACT"],
  ["AC", "ACT"],
  ["ROM", "ROM"],
  ["RO", "ROM"],
  ["1CO", "1CO"],
  ["1COR", "1CO"],
  ["2CO", "2CO"],
  ["2COR", "2CO"],
  ["GAL", "GAL"],
  ["EPH", "EPH"],
  ["PHP", "PHP"],
  ["PHIL", "PHP"],
  ["COL", "COL"],
  ["1TH", "1TH"],
  ["1THES", "1TH"],
  ["2TH", "2TH"],
  ["2THES", "2TH"],
  ["1TI", "1TI"],
  ["1TIM", "1TI"],
  ["2TI", "2TI"],
  ["2TIM", "2TI"],
  ["TIT", "TIT"],
  ["PHM", "PHM"],
  ["HEB", "HEB"],
  ["JAS", "JAS"],
  ["JAM", "JAS"],
  ["1PE", "1PE"],
  ["1PET", "1PE"],
  ["2PE", "2PE"],
  ["2PET", "2PE"],
  ["1JN", "1JN"],
  ["1JOHN", "1JN"],
  ["2JN", "2JN"],
  ["2JOHN", "2JN"],
  ["3JN", "3JN"],
  ["3JOHN", "3JN"],
  ["JUD", "JUD"],
  ["REV", "REV"],
  ["NAH", "NAM"],
  ["TOB", "TOB"],
  ["TOBIT", "TOB"],
  ["JDT", "JDT"],
  ["JUDITH", "JDT"],
  ["1MA", "1MA"],
  ["1MAC", "1MA"],
  ["1MACC", "1MA"],
  ["2MA", "2MA"],
  ["2MAC", "2MA"],
  ["2MACC", "2MA"],
  ["3MA", "3MA"],
  ["3MAC", "3MA"],
  ["3MACC", "3MA"],
  ["WIS", "WIS"],
  ["WISDOM", "WIS"],
  ["SIR", "SIR"],
  ["SIRACH", "SIR"],
  ["ECCLESIASTICUS", "SIR"],
  ["BAR", "BAR"],
  ["BARUCH", "BAR"],
  ["LJE", "LJE"],
  ["LETJER", "LJE"],
  ["SUS", "SUS"],
  ["SUSANNA", "SUS"],
  ["BEL", "BEL"],
  ["1ES", "1ES"],
  ["1ESD", "1ES"],
  ["1ESDRAS", "1ES"]
];

const bookAliases = new Map(bookAliasPairs);

export function resolveBookIdFor(bible: Bible, input: string): string | null {
  const normalized = input.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (!normalized) return null;

  const aliased = bookAliases.get(normalized);
  if (aliased && chaptersForBook(bible, aliased) !== undefined) {
    return aliased;
  }

  const byId = bible.books.find((book) => book.id === normalized);
  if (byId) return byId.id;

  const byPrefix = bible.books.find((book) =>
    book.name.replace(/[^A-Z0-9]/gi, "").toUpperCase().startsWith(normalized)
  );
  return byPrefix?.id ?? null;
}

export function resolveBookId(input: string): string | null {
  return resolveBookIdFor(BIBLES[0], input);
}

export function getBookById(id: string): Book | undefined {
  return BOOKS.find((book) => book.id === id);
}

export function getBookByName(name: string): Book | undefined {
  return BOOKS.find((book) => book.name === name);
}
