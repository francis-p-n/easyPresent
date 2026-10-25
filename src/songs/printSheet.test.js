import { describe, it, expect } from 'vitest'
import { chordRow, slideLines, buildSetlistSheetHtml } from './printSheet.js'
import { starterRecords } from './starterSongs.js'
import { STARTER_SETLIST } from './starterCharts.js'
import { fromRecord } from './songSync.js'

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

describe('printing the real weekly setlist', () => {
  const presentations = starterRecords().map((r) => fromRecord(r))
  const playlist = {
    name: STARTER_SETLIST.name,
    items: STARTER_SETLIST.songIds.map((id) => ({ type: 'presentation', id }))
  }
  const html = buildSetlistSheetHtml(playlist, presentations)

  it('gives every one of the eight songs its own page, in order', () => {
    expect(html.match(/<article>/g)).toHaveLength(8)
    const at = presentations.map((p) => html.indexOf(p.name))
    expect(at.every((v, i) => v >= 0 && (i === 0 || v > at[i - 1]))).toBe(true)
  })

  it('prints chords above the words and never as bracketed text', () => {
    expect(html).toContain('class="chords"')
    expect(html).not.toMatch(/\[[A-G][^\]]*\]/)
  })

  it('keeps each song readable on its own page (key shown where known)', () => {
    expect(html).toContain('Key of Em')
    expect(html).toContain('Key of A')
  })
})
