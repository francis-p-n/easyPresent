import { describe, it, expect } from 'vitest'
import { chordsOverLyricsToChordPro, isChordLine } from './chordSheetParse.js'
import { chordRow, slideLines, buildSetlistSheetHtml } from './printSheet.js'

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

describe('print sheet', () => {
  it('chordRow aligns chords above their positions without touching', () => {
    expect(chordRow([{ pos: 0, chord: 'G' }, { pos: 1, chord: 'Am' }])).toBe('G Am')
    expect(chordRow([{ pos: 4, chord: 'C' }])).toBe('    C')
  })

  it('slideLines falls back to inline markup', () => {
    expect(slideLines({ text: '[G]Hi [C]you' })).toEqual([
      { text: 'Hi you', chords: [{ pos: 0, chord: 'G' }, { pos: 3, chord: 'C' }] }
    ])
  })

  it('builds one page per song in setlist order, skipping non-songs, and escapes HTML', () => {
    const pres = [
      { id: 'a', name: 'Song <A>', category: 'Worship', key: 'G', slides: [{ label: 'Verse 1', text: '[G]One' }] },
      { id: 'b', name: 'Welcome', category: 'Announcements', slides: [{ text: 'Hi' }] },
      { id: 'c', name: 'Song C', category: 'Hymns', slides: [{ label: 'Verse', text: 'Two' }] }
    ]
    const pl = {
      name: 'Week',
      items: [
        { type: 'header', text: 'Worship' },
        { type: 'presentation', id: 'c' },
        { type: 'presentation', id: 'b' },
        { type: 'presentation', id: 'a' }
      ]
    }
    const html = buildSetlistSheetHtml(pl, pres)
    expect(html.match(/<article>/g)).toHaveLength(2)
    expect(html.indexOf('Song C')).toBeLessThan(html.indexOf('Song &lt;A&gt;'))
    expect(html).not.toContain('Welcome')
    expect(html).toContain('Key of G')
    expect(html).toContain('<div class="chords">G</div>')
  })

  it('can omit chords for lyric-only handouts', () => {
    const html = buildSetlistSheetHtml(
      { name: 'W', items: [{ type: 'presentation', id: 'a' }] },
      [{ id: 'a', name: 'S', category: 'Worship', slides: [{ text: '[G]One' }] }],
      { chords: false }
    )
    expect(html).not.toContain('class="chords"')
  })
})
