/**
 * importers — read a Bible file you have the right to use into one structure:
 *
 *   { "John": { "3": { "16": "verse text" } } }   // canonical book names
 *
 * Formats (found from the file name and contents):
 *   - JSON: { book: { chapter: { verse: text } } }, { books: [...] } with chapters/verses,
 *     or a flat list of { book, chapter, verse, text } records
 *   - plain text, one verse per line: "John 3:16 text..." or "John<TAB>3<TAB>16<TAB>text"
 *   - OSIS XML (<verse osisID="John.3.16">)
 *
 * Books are renamed to the canonical names in books.js; a book the app doesn't know is kept
 * under the name the file gave it, so nothing is dropped.
 */
import { resolveBook, BOOK_NAMES } from './books.js'

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&nbsp;': ' ' }
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);|&#39;/g, (m) => ENTITIES[m] ?? m)

const clean = (text) => decode(String(text)).replace(/\s+/g, ' ').trim()

function createCollector() {
  const books = {}
  let verses = 0
  return {
    books,
    add(rawBook, chapter, verse, text) {
      const body = clean(text)
      const ch = Number(chapter)
      const v = Number(verse)
      if (!body || !Number.isFinite(ch) || !Number.isFinite(v)) return
      let name
      if (typeof rawBook === 'number' || /^\d+$/.test(String(rawBook))) name = BOOK_NAMES[Number(rawBook) - 1] // 1..66 numbering
      else name = resolveBook(rawBook) || String(rawBook).trim()
      if (!name) return
      ;((books[name] ??= {})[ch] ??= {})[v] = body
      verses++
    },
    get verses() {
      return verses
    }
  }
}

// ---- JSON ------------------------------------------------------------------

const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v)

function fromNested(obj, c) {
  for (const [book, chapters] of Object.entries(obj))
    if (isPlain(chapters))
      for (const [chapter, verses] of Object.entries(chapters))
        if (isPlain(verses)) for (const [verse, text] of Object.entries(verses)) c.add(book, chapter, verse, text)
}

function fromBookList(list, c) {
  for (const b of list) {
    const book = b.name ?? b.book ?? b.book_name ?? b.abbrev ?? b.title
    const chapters = b.chapters ?? b.chapter
    if (!book || !Array.isArray(chapters)) continue
    chapters.forEach((ch, i) => {
      if (Array.isArray(ch)) {
        ch.forEach((text, j) => c.add(book, i + 1, j + 1, typeof text === 'string' ? text : text?.text))
      } else if (isPlain(ch)) {
        const chapterNo = ch.chapter ?? ch.number ?? i + 1
        ;(ch.verses ?? []).forEach((v, j) =>
          typeof v === 'string' ? c.add(book, chapterNo, j + 1, v) : c.add(book, chapterNo, v.verse ?? v.number ?? j + 1, v.text)
        )
      }
    })
  }
}

function fromRecords(list, c) {
  for (const r of list) {
    c.add(r.book ?? r.book_name ?? r.bookName ?? r.b, r.chapter ?? r.c, r.verse ?? r.v, r.text ?? r.t)
  }
}

function fromJson(value, c) {
  if (Array.isArray(value)) {
    // a list of books has a *list* of chapters per item; a flat list of verses has a chapter *number*
    if (Array.isArray(value[0]?.chapters)) fromBookList(value, c)
    else fromRecords(value, c)
    return
  }
  if (!isPlain(value)) return
  if (Array.isArray(value.books)) return fromBookList(value.books, c)
  if (Array.isArray(value.verses)) return fromRecords(value.verses, c)
  fromNested(value, c)
}

// ---- plain text ----------------------------------------------------------

function fromLines(text, c) {
  const spaced = /^\s*((?:[1-3]\s?)?[A-Za-z][A-Za-z.' ]*?)\s+(\d+)\s*[:.]\s*(\d+)\s*[\t ]\s*(.+)$/
  const tabbed = /^\s*([^\t]+)\t(\d+)\t(\d+)\t(.+)$/
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(tabbed) || line.match(spaced)
    if (m) c.add(m[1], m[2], m[3], m[4])
  }
}

// ---- OSIS XML ----------------------------------------------------------

function fromOsis(xml, c) {
  const addId = (id, body) => {
    const [first] = id.split(/[\s-]/)
    const [book, chapter, verse] = first.split('.')
    if (book && chapter && verse) c.add(book, chapter, verse, body.replace(/<[^>]*>/g, ' '))
  }
  // container style: <verse osisID="John.3.16">text</verse>
  const container = /<verse\b[^>]*\bosisID="([^"]+)"[^>]*>([\s\S]*?)<\/verse>/g
  let m
  let found = false
  while ((m = container.exec(xml)) !== null) {
    found = true
    addId(m[1], m[2])
  }
  if (found) return
  // milestone style: <verse sID="John.3.16" osisID="John.3.16"/> text <verse eID="John.3.16"/>
  const milestone = /<verse\b[^>]*\bsID="([^"]+)"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID=/g
  while ((m = milestone.exec(xml)) !== null) addId(m[1], m[2])
}

/**
 * Parses a Bible file's text. Returns { books, verseCount, bookCount }.
 * Throws an Error saying what was wrong when nothing usable is found.
 */
export function parseBibleFile(text, filename = '') {
  const c = createCollector()
  const trimmed = text.trimStart()
  const looksJson = /\.json$/i.test(filename) || trimmed.startsWith('{') || trimmed.startsWith('[')

  if (/osisID|<osis/i.test(text.slice(0, 20000))) {
    fromOsis(text, c)
  } else if (looksJson) {
    let value
    try {
      value = JSON.parse(text)
    } catch (e) {
      throw new Error(`The file is not valid JSON (${e.message})`, { cause: e })
    }
    fromJson(value, c)
  } else {
    fromLines(text, c)
  }

  if (!c.verses) {
    throw new Error(
      'No verses found. Use a file with one verse per line ("John 3:16 text"), OSIS XML, or JSON of books, chapters and verses.'
    )
  }
  return { books: c.books, verseCount: c.verses, bookCount: Object.keys(c.books).length }
}
