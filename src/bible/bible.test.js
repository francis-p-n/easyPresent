import { describe, it, expect } from 'vitest'
import { resolveBook, BOOK_NAMES } from './books.js'
import { parseReference, formatReference, lookupPassage, buildScriptureSlides } from './reference.js'
import { parseBibleFile } from './importers.js'

// All verse text in these tests is invented; no real translation is used.

describe('resolveBook', () => {
  it('knows full names, abbreviations and OSIS ids', () => {
    expect(resolveBook('John')).toBe('John')
    expect(resolveBook('jn')).toBe('John')
    expect(resolveBook('Ps')).toBe('Psalms')
    expect(resolveBook('Psalm')).toBe('Psalms')
    expect(resolveBook('Phlm')).toBe('Philemon')
    expect(resolveBook('Rev')).toBe('Revelation')
    expect(resolveBook('Song of Songs')).toBe('Song of Solomon')
  })

  it('handles numbered books in every common spelling', () => {
    for (const s of ['1 Cor', '1Cor', '1 Corinthians', 'I Cor', 'First Corinthians', '1st Corinthians', '1. Cor']) {
      expect(resolveBook(s), s).toBe('1 Corinthians')
    }
    expect(resolveBook('II Kings')).toBe('2 Kings')
    expect(resolveBook('3 John')).toBe('3 John')
    expect(resolveBook('1 Jn')).toBe('1 John')
    expect(resolveBook('1 Sam')).toBe('1 Samuel')
  })

  it('knows the deuterocanonical books of an NRSV-CE', () => {
    expect(resolveBook('Tobit')).toBe('Tobit')
    expect(resolveBook('Wis')).toBe('Wisdom')
    expect(resolveBook('Sirach')).toBe('Sirach')
    expect(resolveBook('Ecclesiasticus')).toBe('Sirach')
    expect(resolveBook('1 Maccabees')).toBe('1 Maccabees')
    expect(resolveBook('2 Macc')).toBe('2 Maccabees')
    expect(resolveBook('Bar')).toBe('Baruch')
    expect(resolveBook('Judith')).toBe('Judith')
  })

  it('accepts an unambiguous prefix and rejects nonsense', () => {
    expect(resolveBook('Revel')).toBe('Revelation')
    expect(resolveBook('xyzzy')).toBeNull()
    expect(resolveBook('')).toBeNull()
  })

  it('lists the 66 books first, in order', () => {
    expect(BOOK_NAMES.slice(0, 3)).toEqual(['Genesis', 'Exodus', 'Leviticus'])
    expect(BOOK_NAMES[65]).toBe('Revelation')
    expect(BOOK_NAMES).toContain('Tobit')
  })
})

describe('parseReference', () => {
  it('reads a verse, a range and a whole chapter', () => {
    expect(parseReference('John 3:16')).toEqual({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 })
    expect(parseReference('jn 3:16-18')).toEqual({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 18 })
    expect(parseReference('Ps 23')).toEqual({ book: 'Psalms', chapter: 23, verseStart: null, verseEnd: null })
  })

  it('copes with numbered books, missing spaces and dashes', () => {
    expect(parseReference('1Cor13:4–7')).toEqual({ book: '1 Corinthians', chapter: 13, verseStart: 4, verseEnd: 7 })
    expect(parseReference('  2 Tim 3:16 ')).toEqual({ book: '2 Timothy', chapter: 3, verseStart: 16, verseEnd: 16 })
    expect(parseReference('Song of Songs 2:1').book).toBe('Song of Solomon')
  })

  it('explains what is wrong', () => {
    expect(parseReference('').error).toMatch(/Type a reference/)
    expect(parseReference('blah 3:1').error).toMatch(/not a book/)
    expect(parseReference('John').error).toMatch(/not a reference/)
    expect(parseReference('John 3:18-16').error).toMatch(/last verse/)
  })

  it('formats references back', () => {
    expect(formatReference({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 18 })).toBe('John 3:16-18')
    expect(formatReference({ book: 'John', chapter: 3, verseStart: 16, verseEnd: 16 })).toBe('John 3:16')
    expect(formatReference({ book: 'Psalms', chapter: 23, verseStart: null, verseEnd: null })).toBe('Psalms 23')
  })
})

describe('lookupPassage and slides', () => {
  const bible = { id: 'TEST', books: { John: { 3: { 14: 'Verse fourteen.', 15: 'Verse fifteen.', 16: 'Verse sixteen.', 17: 'Verse seventeen.' } } } }

  it('returns a range, a single verse and a whole chapter', () => {
    const range = lookupPassage(bible, { book: 'John', chapter: 3, verseStart: 15, verseEnd: 16 })
    expect(range.verses.map((v) => v.number)).toEqual([15, 16])
    expect(range.reference).toBe('John 3:15-16')
    expect(lookupPassage(bible, { book: 'John', chapter: 3, verseStart: 14, verseEnd: 14 }).verses[0].text).toBe('Verse fourteen.')
    expect(lookupPassage(bible, { book: 'John', chapter: 3, verseStart: null, verseEnd: null }).verses).toHaveLength(4)
  })

  it('shows what exists when a range runs past the end', () => {
    const p = lookupPassage(bible, { book: 'John', chapter: 3, verseStart: 16, verseEnd: 40 })
    expect(p.verses.map((v) => v.number)).toEqual([16, 17])
    expect(p.reference).toBe('John 3:16-17')
  })

  it('says when the translation lacks the chapter or the verse', () => {
    expect(lookupPassage(bible, { book: 'John', chapter: 9, verseStart: 1, verseEnd: 1 }).error).toMatch(/no John 9/)
    expect(lookupPassage(bible, { book: 'John', chapter: 3, verseStart: 99, verseEnd: 99 }).error).toMatch(/no John 3:99/)
    expect(lookupPassage(bible, { book: 'Tobit', chapter: 1, verseStart: 1, verseEnd: 1 }).error).toBeTruthy()
  })

  it('builds one slide per verse with the reference and translation under the words', () => {
    const passage = lookupPassage(bible, { book: 'John', chapter: 3, verseStart: 15, verseEnd: 16 })
    const slides = buildScriptureSlides(passage, 'TEST')
    expect(slides).toHaveLength(2)
    expect(slides[1].text).toBe('Verse sixteen.\n\nJohn 3:16 TEST')
    expect(new Set(slides.map((s) => s.id)).size).toBe(2)
  })
})

describe('parseBibleFile', () => {
  it('reads JSON of book > chapter > verse', () => {
    const r = parseBibleFile(JSON.stringify({ John: { 3: { 16: 'Sample sixteen.' } }, Jn: { 1: { 1: 'Sample one.' } } }), 'x.json')
    expect(r.books.John[3][16]).toBe('Sample sixteen.')
    expect(r.books.John[1][1]).toBe('Sample one.') // "Jn" folded into John
    expect(r.verseCount).toBe(2)
  })

  it('reads a JSON list of books with chapters and verses', () => {
    const data = { books: [{ name: 'Genesis', chapters: [{ chapter: 1, verses: [{ verse: 1, text: 'Alpha.' }, { verse: 2, text: 'Beta.' }] }] }, { name: 'Tobit', chapters: [['Gamma.']] }] }
    const r = parseBibleFile(JSON.stringify(data), 'b.json')
    expect(r.books.Genesis[1][2]).toBe('Beta.')
    expect(r.books.Tobit[1][1]).toBe('Gamma.')
  })

  it('reads a flat list of verse records, including numbered books', () => {
    const rows = [
      { book: 1, chapter: 1, verse: 1, text: 'First.' },
      { book_name: 'Psalm', chapter: 23, verse: 1, text: 'Shepherd.' }
    ]
    const r = parseBibleFile(JSON.stringify(rows), 'r.json')
    expect(r.books.Genesis[1][1]).toBe('First.')
    expect(r.books.Psalms[23][1]).toBe('Shepherd.')
  })

  it('reads one verse per line, spaced or tab separated', () => {
    const text = ['John 3:16 Sample sixteen.', '1 Cor 13:4\tLove is patient (sample).', 'Wisdom\t3\t1\tSample wisdom.', 'not a verse line', ''].join('\n')
    const r = parseBibleFile(text, 'NRSV.txt')
    expect(r.books.John[3][16]).toBe('Sample sixteen.')
    expect(r.books['1 Corinthians'][13][4]).toBe('Love is patient (sample).')
    expect(r.books.Wisdom[3][1]).toBe('Sample wisdom.')
    expect(r.verseCount).toBe(3)
  })

  it('reads OSIS XML, container and milestone styles, stripping markup and entities', () => {
    const container = '<osis><verse osisID="John.3.16">Sample <i>sixteen</i> &amp; more.</verse><verse osisID="1Cor.13.4">Sample four.</verse></osis>'
    const a = parseBibleFile(container, 'a.xml')
    expect(a.books.John[3][16]).toBe('Sample sixteen & more.')
    expect(a.books['1 Corinthians'][13][4]).toBe('Sample four.')
    const milestone = '<osis><verse sID="Gen.1.1" osisID="Gen.1.1"/>Sample one.<verse eID="Gen.1.1"/><verse sID="Gen.1.2" osisID="Gen.1.2"/>Sample two.<verse eID="Gen.1.2"/></osis>'
    const b = parseBibleFile(milestone, 'b.xml')
    expect(b.books.Genesis[1][2]).toBe('Sample two.')
  })

  it('keeps a book it does not recognise instead of dropping it', () => {
    const r = parseBibleFile('Book of Imaginary 2:3 Sample text.', 'x.txt')
    expect(Object.keys(r.books)).toEqual(['Book of Imaginary'])
  })

  it('refuses a file with no verses, and bad JSON, with a clear message', () => {
    expect(() => parseBibleFile('just some words', 'x.txt')).toThrow(/No verses found/)
    expect(() => parseBibleFile('{ broken', 'x.json')).toThrow(/not valid JSON/)
  })
})
