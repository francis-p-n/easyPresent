import { describe, it, expect } from 'vitest'
import { chordsOverLyricsToChordPro, isChordLine } from './chordSheetParse.js'

describe('isChordLine', () => {
  it('accepts chord rows incl. slash, sus, 7ths and repeat marks', () => {
    expect(isChordLine('G  D/F#  Am7  Dsus  C6/E  x2')).toBe(true)
  })
  it('rejects lyric lines, even ones starting with a chord-like word', () => {
    expect(isChordLine('Be still and know')).toBe(false)
    expect(isChordLine('A bright morning')).toBe(false)
    expect(isChordLine('')).toBe(false)
  })
})

describe('chordsOverLyricsToChordPro', () => {
  it('places each chord at the column it sat over', () => {
    const out = chordsOverLyricsToChordPro('[Verse 1]\nG       C\nLa la la la la la\n')
    expect(out).toBe('[Verse 1]\n[G]La la la[C] la la la')
  })

  it('appends chords that fall past the end of the lyric', () => {
    expect(chordsOverLyricsToChordPro('C         D\nOh no')).toBe('[C]Oh no[D]')
  })

  it('drops chord-only sections together with their header', () => {
    const out = chordsOverLyricsToChordPro('[Intro]\nG D Em\n\n[Verse]\nG\nHello there')
    expect(out).not.toMatch(/Intro/)
    expect(out).toBe('[Verse]\n[G]Hello there')
  })

  it('collapses spaced syllable hyphens and keeps chords aligned', () => {
    const out = chordsOverLyricsToChordPro('C         D\nFa - ther me')
    expect(out).toBe('[C]Father [D]me')
  })

  it('keeps blank-line separation between sections', () => {
    const out = chordsOverLyricsToChordPro('[Verse]\nG\nOne\n\n[Chorus]\nC\nTwo')
    expect(out).toBe('[Verse]\n[G]One\n\n[Chorus]\n[C]Two')
  })
})
