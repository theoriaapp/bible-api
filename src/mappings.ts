export type Book = {
  id: string;
  name: string;
  chapters: number;
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
  ["REV", "REV"]
];

const bookAliases = new Map(bookAliasPairs);

export function resolveBookId(input: string): string | null {
  const normalized = input.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (!normalized) return null;
  if (bookAliases.has(normalized)) {
    return bookAliases.get(normalized) ?? null;
  }

  const byId = BOOKS.find((book) => book.id === normalized);
  if (byId) return byId.id;

  const byPrefix = BOOKS.find((book) =>
    book.name.replace(/[^A-Z0-9]/gi, "").toUpperCase().startsWith(normalized)
  );
  return byPrefix?.id ?? null;
}

export function getBookById(id: string): Book | undefined {
  return BOOKS.find((book) => book.id === id);
}

export function getBookByName(name: string): Book | undefined {
  return BOOKS.find((book) => book.name === name);
}
