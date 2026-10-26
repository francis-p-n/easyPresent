import { describe, it, expect } from 'vitest'
import { transposeChord, transposeKey, semitonesBetween, normalizeSemitones, keyOptions, makeTransposer, describeShift } from './transpose.js'

describe('transposeChord', () => {
  it('moves the root and keeps the quality', () => {
    expect(transposeChord('G', 2)).toBe('A')
    expect(transposeChord('Em7', 3)).toBe('Gm7')
    expect(transposeChord('Dsus4', 5)).toBe('Gsus4')
    expect(transposeChord('C6', 2)).toBe('D6')
  })

  it('moves the bass note of slash chords too', () => {
    expect(transposeChord('G/B', 2)).toBe('A/C#')
    expect(transposeChord('C6/E', -2, true)).toBe('Bb6/D')
  })

  it('wraps around the octave in both directions', () => {
    expect(transposeChord('B', 1)).toBe('C')
    expect(transposeChord('C', -1)).toBe('B')
  })

  it('spells with flats or sharps as asked', () => {
    expect(transposeChord('C', 1, true)).toBe('Db')
    expect(transposeChord('C', 1, false)).toBe('C#')
  })

  it('leaves the chord exactly as written at zero, and ignores non-chords', () => {
    expect(transposeChord('Db', 0)).toBe('Db')
    expect(transposeChord('N.C.', 3)).toBe('N.C.')
  })
})

describe('keys', () => {
  it('transposes a key name, choosing flats where that key uses them', () => {
    expect(transposeKey('G', 2)).toBe('A')
    expect(transposeKey('G', 3)).toBe('Bb')
    expect(transposeKey('Db', 2)).toBe('Eb')
    expect(transposeKey('E', 1)).toBe('F')
    expect(transposeKey('Em', 3)).toBe('Gm')
    expect(transposeKey('Em', 2)).toBe('F#m')
  })

  it('works out the half steps between two keys, the short way round', () => {
    expect(semitonesBetween('G', 'A')).toBe(2)
    expect(semitonesBetween('G', 'E')).toBe(-3)
    expect(semitonesBetween('C', 'F#')).toBe(-6)
    expect(semitonesBetween('Em', 'Gm')).toBe(3)
  })

  it('normalises any number of half steps into -6..+5', () => {
    expect(normalizeSemitones(7)).toBe(-5)
    expect(normalizeSemitones(-7)).toBe(5)
    expect(normalizeSemitones(12)).toBe(0)
  })

  it('offers twelve keys with the original at zero', () => {
    const options = keyOptions('G')
    expect(options).toHaveLength(12)
    expect(options.find((o) => o.semitones === 0).label).toBe('G')
    expect(options.find((o) => o.semitones === 2).label).toBe('A')
  })

  it('describes the shift in words', () => {
    expect(describeShift(0)).toBe('Original')
    expect(describeShift(2)).toBe('+2')
    expect(describeShift(-3)).toBe('-3')
  })
})

describe('makeTransposer', () => {
  const song = (extra) => ({
    key: 'G',
    slides: [{ linesData: [{ chords: [{ chord: 'G' }, { chord: 'C/E' }, { chord: 'Em' }] }] }],
    ...extra
  })

  it('is the identity for a song in its original key', () => {
    const t = makeTransposer(song())
    expect(t('C/E')).toBe('C/E')
  })

  it('moves every chord and picks the spelling of the new key', () => {
    const up3 = makeTransposer(song({ transpose: 3 })) // G -> Bb: flats
    expect(up3('G')).toBe('Bb')
    expect(up3('Em')).toBe('Gm')
    expect(up3('C/E')).toBe('Eb/G')
    const up2 = makeTransposer(song({ transpose: 2 })) // G -> A: sharps
    expect(up2('C/E')).toBe('D/F#')
  })

  it('without a known key, keeps flats if the chart was written with flats', () => {
    const flatSong = { slides: [{ linesData: [{ chords: [{ chord: 'Db' }, { chord: 'Gb' }] }] }], transpose: 1 }
    expect(makeTransposer(flatSong)('Db')).toBe('D')
    expect(makeTransposer(flatSong)('Gb')).toBe('G')
    const t = makeTransposer({ ...flatSong, transpose: 2 })
    expect(t('Db')).toBe('Eb')
  })
})
