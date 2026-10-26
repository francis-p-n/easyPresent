/**
 * transpose — change the key of a song's chords.
 *
 * A song keeps its original chords; the operator sets `transpose` (half steps,
 * -6..+5) on the presentation, and every place that shows chords (chord view,
 * printed sheet, band Stage window) passes each chord through makeTransposer().
 * Resetting to 0 gives back the original chords exactly.
 */

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

// Keys that are written with flats (the rest use sharps). Minor keys carry an "m".
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'])

// root, then everything up to an optional /bass note
const CHORD = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/

/** Position of a note name (C = 0 ... B = 11), or -1 if it isn't one. */
export function noteIndex(note) {
  const sharp = SHARPS.indexOf(note)
  return sharp !== -1 ? sharp : FLATS.indexOf(note)
}

/** Wraps any number of half steps into -6..+5 (the smallest move to the same pitch class). */
export function normalizeSemitones(n) {
  const mod = ((Math.round(n) % 12) + 12) % 12
  return mod > 5 ? mod - 12 : mod
}

const nameAt = (index, useFlats) => (useFlats ? FLATS : SHARPS)[((index % 12) + 12) % 12]

/**
 * Moves one chord by `semitones`. Slash chords move their bass note too
 * (G/B -> A/C#). With 0 half steps the chord is returned untouched, so the
 * original spelling is never altered. Anything that isn't a chord is returned as is.
 */
export function transposeChord(chord, semitones, useFlats = false) {
  if (!semitones) return chord
  const m = chord.match(CHORD)
  if (!m) return chord
  const [, root, quality, bass] = m
  const moved = nameAt(noteIndex(root) + semitones, useFlats)
  return moved + quality + (bass ? '/' + nameAt(noteIndex(bass) + semitones, useFlats) : '')
}

/** The key name after moving `semitones` ("G" + 2 = "A"; "Em" + 3 = "Gm"). Spelled with flats where that key uses them. */
export function transposeKey(key, semitones) {
  const m = key && key.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return key || ''
  if (!semitones) return key
  const [, root, suffix] = m
  const index = noteIndex(root) + semitones
  const flat = nameAt(index, true) + suffix
  return FLAT_KEYS.has(flat) ? flat : nameAt(index, false) + suffix
}

/** Half steps (-6..+5) that take `fromKey` to `toKey`. */
export function semitonesBetween(fromKey, toKey) {
  const a = fromKey && fromKey.match(/^([A-G][#b]?)/)
  const b = toKey && toKey.match(/^([A-G][#b]?)/)
  if (!a || !b) return 0
  return normalizeSemitones(noteIndex(b[1]) - noteIndex(a[1]))
}

/** All twelve keys the singer could ask for, as { semitones, label } relative to the original key. */
export function keyOptions(originalKey) {
  const options = []
  for (let s = -6; s <= 5; s++) options.push({ semitones: s, label: transposeKey(originalKey, s) })
  return options
}

/** "+2", "-3" or "Original" — how far a song is from its written key. */
export function describeShift(semitones) {
  if (!semitones) return 'Original'
  return (semitones > 0 ? '+' : '-') + Math.abs(semitones)
}

/**
 * Should transposed chords be spelled with flats? Decided by the new key when
 * the song's key is known, otherwise by how the original chords were written.
 */
function wantsFlats(key, semitones, chords) {
  if (key && /^[A-G]/.test(key)) return FLAT_KEYS.has(transposeKey(key, semitones))
  return chords.some((c) => /^[A-G]b/.test(c)) && !chords.some((c) => /^[A-G]#/.test(c))
}

/**
 * A function chord -> chord for a presentation at its current transposition.
 * Identity when the song is in its original key.
 */
export function makeTransposer(presentation) {
  const semitones = normalizeSemitones(presentation?.transpose || 0)
  if (!semitones) return (chord) => chord
  const chords = (presentation.slides || []).flatMap((s) => (s.linesData || []).flatMap((l) => (l.chords || []).map((c) => c.chord)))
  const useFlats = wantsFlats(presentation.key, semitones, chords)
  return (chord) => transposeChord(chord, semitones, useFlats)
}
