import { describe, it, expect } from 'vitest'
import { chordRow, slideLines, buildSetlistSheetHtml, displayWidth, columnOf } from './printSheet.js'
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

describe('printing a song in another key', () => {
  const song = (extra) => ({
    id: 's',
    name: 'Test Song',
    category: 'Worship',
    key: 'G',
    slides: [{ label: 'Verse 1', text: 'One two', linesData: [{ text: 'One two', chords: [{ pos: 0, chord: 'G' }, { pos: 4, chord: 'C/E' }] }] }],
    ...extra
  })
  const html = (pres) => buildSetlistSheetHtml({ name: 'W', items: [{ type: 'presentation', id: 's' }] }, [pres])

  it('prints the written chords and key when not transposed', () => {
    const out = html(song())
    expect(out).toContain('<div class="chords">G   C/E</div>')
    expect(out).toContain('Key of G')
  })

  it('prints the chords in the new key and says where it came from', () => {
    const out = html(song({ transpose: 2 }))
    expect(out).toContain('<div class="chords">A   D/F#</div>')
    expect(out).toContain('Key of A (written in G, +2)')
  })

  it('does not change the stored song', () => {
    const pres = song({ transpose: 2 })
    html(pres)
    expect(pres.slides[0].linesData[0].chords[0].chord).toBe('G')
  })
})

describe('print layout for wide characters and long words', () => {
  it('counts CJK and Hangul as two columns, combining accents as none', () => {
    expect(displayWidth('abc')).toBe(3)
    expect(displayWidth('\u4f60\u597d')).toBe(4)
    expect(displayWidth('\ud55c\uae00')).toBe(4)
    expect(displayWidth('e\u0301')).toBe(1)
  })

  it('places a chord over the right column of a line containing wide characters', () => {
    // "\u4f60\u597dab": a chord before "a" (index 2) belongs over column 4, not column 2
    expect(columnOf('\u4f60\u597dab', 2)).toBe(4)
    expect(columnOf('abcd', 2)).toBe(2)
  })

  it('prints the chord over the matching column in the sheet', () => {
    const pres = {
      id: 's',
      name: 'Wide',
      category: 'Worship',
      slides: [{ label: 'V', text: '\u4f60\u597dab', linesData: [{ text: '\u4f60\u597dab', chords: [{ pos: 2, chord: 'G' }] }] }]
    }
    const html = buildSetlistSheetHtml({ name: 'W', items: [{ type: 'presentation', id: 's' }] }, [pres])
    expect(html).toContain('<div class="chords">    G</div>') // four spaces: two wide characters
  })

  it('lets a very long word wrap instead of running off the page', () => {
    const html = buildSetlistSheetHtml({ name: 'W', items: [] }, [])
    expect(html).toMatch(/overflow-wrap:\s*anywhere/)
    expect(html).toMatch(/white-space:\s*pre-wrap/)
  })
})
