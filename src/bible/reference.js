/**
 * reference — turn "Jn 3:16-18" into a passage, and a passage into slides.
 *
 * A translation is { id, name, books: { [canonical book]: { [chapter]: { [verse]: text } } } }.
 */
import { resolveBook } from './books.js'

/**
 * Parses what the operator types.
 *   "John 3:16"  "jn 3:16-18"  "1 Cor 13"  "1Cor13:4-7"  "Ps 23"  "Song of Songs 2:1"
 * Returns { book, chapter, verseStart, verseEnd } (verses null for a whole chapter),
 * or { error } saying what was wrong.
 */
export function parseReference(input) {
  const text = String(input || '').trim()
  if (!text) return { error: 'Type a reference, e.g. John 3:16' }

  // book name (may start with a number), chapter, optional :verse[-verse]
  const m = text.match(/^(.*?[A-Za-z.])\s*(\d+)\s*(?:[:.]\s*(\d+)\s*(?:[-–—]\s*(\d+))?)?\s*$/)
  if (!m) return { error: `"${text}" is not a reference. Use Book Chapter[:Verse[-Verse]], e.g. John 3:16-18` }

  const book = resolveBook(m[1])
  if (!book) return { error: `"${m[1].trim()}" is not a book of the Bible` }

  const chapter = parseInt(m[2], 10)
  const verseStart = m[3] ? parseInt(m[3], 10) : null
  const verseEnd = m[4] ? parseInt(m[4], 10) : verseStart
  if (verseStart !== null && verseEnd < verseStart) return { error: 'The last verse comes before the first' }
  return { book, chapter, verseStart, verseEnd }
}

/** Compact reference text: "John 3:16", "John 3:16-18", "Psalms 23". */
export function formatReference({ book, chapter, verseStart, verseEnd }) {
  if (verseStart === null) return `${book} ${chapter}`
  return verseEnd > verseStart ? `${book} ${chapter}:${verseStart}-${verseEnd}` : `${book} ${chapter}:${verseStart}`
}

/**
 * The verses a reference covers in a translation.
 * Returns { book, chapter, reference, verses: [{ number, text }] } or { error }.
 */
export function lookupPassage(translation, ref) {
  const chapterVerses = translation?.books?.[ref.book]?.[ref.chapter]
  if (!chapterVerses) {
    return { error: `${translation?.id || 'This Bible'} has no ${ref.book} ${ref.chapter}` }
  }
  const numbers = Object.keys(chapterVerses)
    .map(Number)
    .sort((a, b) => a - b)
  const from = ref.verseStart ?? numbers[0]
  const to = ref.verseEnd ?? numbers[numbers.length - 1]
  const verses = numbers.filter((n) => n >= from && n <= to).map((number) => ({ number, text: chapterVerses[number] }))
  if (!verses.length) return { error: `${translation.id} has no ${formatReference(ref)}` }
  // A range that runs past the end of the chapter shows what exists
  return {
    book: ref.book,
    chapter: ref.chapter,
    reference: formatReference({ ...ref, verseStart: verses[0].number, verseEnd: verses[verses.length - 1].number }),
    verses
  }
}

/**
 * One slide per verse (the reference and translation under the words), so the
 * arrow keys step through the passage like any song. Long verses stay whole.
 */
export function buildScriptureSlides(passage, translationId) {
  const stamp = Date.now()
  return passage.verses.map((v, i) => ({
    id: `scripture-${stamp}-${i}`,
    group: 'scripture',
    label: `Verse ${v.number}`,
    text: `${v.text}\n\n${passage.book} ${passage.chapter}:${v.number} ${translationId}`,
    type: 'text'
  }))
}
