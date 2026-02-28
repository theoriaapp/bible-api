# CSV Verse Reference Guide

Use this guide when uploading Bible plan CSV rows so they can be converted into valid Bible API requests.

## Goal

Each CSV row should map to one passage request in this format:

`/v1/bibles/NKJV/passages/{passageId}`

Where `passageId` is:

`BOOK.CHAPTER.START_VERSE-BOOK.CHAPTER.END_VERSE`

Example:

`1SA.8.1-1SA.8.22`

---

## Recommended CSV Columns

Use these columns (or map your existing columns to these):

- `book` (example: `1 Samuel`)
- `reference_start` (example: `8:1`)
- `reference_end` (example: `8:22`)
- optional `bible_id` (default `NKJV`)

---

## How To Convert A Row To `passageId`

1. Convert `book` to Bible API `BOOK` id:
   - `Genesis -> GEN`
   - `John -> JHN`
   - `1 Samuel -> 1SA`
   - `2 Corinthians -> 2CO`
2. Parse `reference_start` into `chapter_start:verse_start`.
3. Parse `reference_end` into `chapter_end:verse_end`.
4. Build:
   - `BOOK.chapter_start.verse_start-BOOK.chapter_end.verse_end`

### Example

CSV row:

- `book = 1 Samuel`
- `reference_start = 8:1`
- `reference_end = 8:22`

Becomes:

- `passageId = 1SA.8.1-1SA.8.22`
- Request URL: `/v1/bibles/NKJV/passages/1SA.8.1-1SA.8.22`

---

## Single Verse

For one verse, make start and end the same.

Example:

- `book = John`
- `reference_start = 3:16`
- `reference_end = 3:16`

Becomes:

- `JHN.3.16-JHN.3.16`

---

## All Supported Book Mappings

Use these exact `BOOK` ids when generating `passageId`:

- `Genesis -> GEN`
- `Exodus -> EXO`
- `Leviticus -> LEV`
- `Numbers -> NUM`
- `Deuteronomy -> DEU`
- `Joshua -> JOS`
- `Judges -> JDG`
- `Ruth -> RUT`
- `1 Samuel -> 1SA`
- `2 Samuel -> 2SA`
- `1 Kings -> 1KI`
- `2 Kings -> 2KI`
- `1 Chronicles -> 1CH`
- `2 Chronicles -> 2CH`
- `Ezra -> EZR`
- `Nehemiah -> NEH`
- `Esther -> EST`
- `Job -> JOB`
- `Psalms -> PSA`
- `Proverbs -> PRO`
- `Ecclesiastes -> ECC`
- `Song of Solomon -> SNG`
- `Isaiah -> ISA`
- `Jeremiah -> JER`
- `Lamentations -> LAM`
- `Ezekiel -> EZK`
- `Daniel -> DAN`
- `Hosea -> HOS`
- `Joel -> JOL`
- `Amos -> AMO`
- `Obadiah -> OBA`
- `Jonah -> JON`
- `Micah -> MIC`
- `Nahum -> NAM`
- `Habakkuk -> HAB`
- `Zephaniah -> ZEP`
- `Haggai -> HAG`
- `Zechariah -> ZEC`
- `Malachi -> MAL`
- `Matthew -> MAT`
- `Mark -> MRK`
- `Luke -> LUK`
- `John -> JHN`
- `Acts -> ACT`
- `Romans -> ROM`
- `1 Corinthians -> 1CO`
- `2 Corinthians -> 2CO`
- `Galatians -> GAL`
- `Ephesians -> EPH`
- `Philippians -> PHP`
- `Colossians -> COL`
- `1 Thessalonians -> 1TH`
- `2 Thessalonians -> 2TH`
- `1 Timothy -> 1TI`
- `2 Timothy -> 2TI`
- `Titus -> TIT`
- `Philemon -> PHM`
- `Hebrews -> HEB`
- `James -> JAS`
- `1 Peter -> 1PE`
- `2 Peter -> 2PE`
- `1 John -> 1JN`
- `2 John -> 2JN`
- `3 John -> 3JN`
- `Jude -> JUD`
- `Revelation -> REV`

---

## Validation Rules (Important)

- `book` must map to a valid Bible API book id (like `GEN`, `EXO`, `JHN`, `1SA`).
- `reference_start` and `reference_end` must be `chapter:verse` (numbers only).
- Start must be before or equal to end.
- Do not include translation in references (translation is handled separately, usually `NKJV`).
- Do not include extra spaces in generated `passageId`.

---

## Valid Examples

- `GEN.1.1-GEN.1.5`
- `JHN.3.16-JHN.3.16`
- `1SA.8.1-1SA.8.22`
- `PSA.23.1-PSA.23.6`

## Invalid Examples

- `John 3:16-3:18` (book name format is for search, not passages endpoint)
- `GEN 1:1-1:5` (wrong separator format)
- `GEN.1.1-1.5` (missing book in end ref for this CSV spec)
- `GEN.1-GEN.1.5` (start verse missing)

---

## Optional: Search Endpoint Compatibility

If your pipeline prefers natural language and not strict `BOOK` ids, you can use:

`/v1/search?q={query}`

Examples:

- `John 3:16 NKJV`
- `1 Samuel 8:1-22 NKJV`

But for CSV imports, the strict `passageId` format is recommended because it is deterministic and easier to validate.
