import { describe, it, expect } from 'vitest'
import { slideLines, buildSetlistSheetHtml } from './printSheet.js'
import { starterRecords } from './starterSongs.js'
import { STARTER_SETLIST } from './starterCharts.js'
import { fromRecord } from './songSync.js'

describe('print sheet', () => {
  it('puts each chord on a segment with the words it precedes, never on padded spaces', () => {
    const html = buildSetlistSheetHtml(
      { name: 'W', items: [{ type: 'presentation', id: 'a' }] },
      [{ id: 'a', name: 'S', category: 'Worship', slides: [{ label: 'V', text: '[G]Hi [Am]you' }] }]
    )
    expect(html).toContain('<span class="seg"><span class="chords">G</span><span class="t">Hi </span></span>')
    expect(html).toContain('<span class="seg"><span class="chords">Am</span><span class="t">you</span></span>')
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
    expect(html).toContain('<span class="chords">G</span>')
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
    expect(out).toContain('<span class="chords">G</span><span class="t">One </span>')
    expect(out).toContain('<span class="chords">C/E</span><span class="t">two</span>')
    expect(out).toContain('Key of G')
  })

  it('prints the chords in the new key and says where it came from', () => {
    const out = html(song({ transpose: 2 }))
    expect(out).toContain('<span class="chords">A</span><span class="t">One </span>')
    expect(out).toContain('<span class="chords">D/F#</span><span class="t">two</span>')
    expect(out).toContain('Key of A (written in G, +2)')
  })

  it('does not change the stored song', () => {
    const pres = song({ transpose: 2 })
    html(pres)
    expect(pres.slides[0].linesData[0].chords[0].chord).toBe('G')
  })
})

describe('print layout for wide characters and long words', () => {
  it('keeps a chord with its own syllable in Japanese, Korean and Arabic, whatever the font', () => {
    const html = buildSetlistSheetHtml(
      { name: 'W', items: [{ type: 'presentation', id: 's' }] },
      [{
        id: 's',
        name: 'Wide',
        category: 'Worship',
        slides: [
          { label: 'V', text: 'x', linesData: [{ text: '你好ab', chords: [{ pos: 2, chord: 'G' }] }] },
          { label: 'W', text: 'x', linesData: [{ text: '한글사랑', chords: [{ pos: 0, chord: 'Am' }, { pos: 2, chord: 'D' }] }] },
          { label: 'X', text: 'x', linesData: [{ text: 'مرحبا بك', chords: [{ pos: 6, chord: 'C' }] }] }
        ]
      }]
    )
    // the chord is paired with the characters it precedes, so nothing depends on how wide a glyph is drawn
    expect(html).toContain('<span class="t">你好</span>')
    expect(html).toContain('<span class="chords">G</span><span class="t">ab</span>')
    expect(html).toContain('<span class="chords">Am</span><span class="t">한글</span>')
    expect(html).toContain('<span class="chords">D</span><span class="t">사랑</span>')
    expect(html).toContain('<span class="chords">C</span><span class="t">بك</span>')
  })

  it('marks a slide that carries on the section above, and repeats the song title on every page', () => {
    const slide = (text) => ({ label: 'Verse 1', group: 'verse', text, linesData: [{ text, chords: [] }] })
    const html = buildSetlistSheetHtml(
      { name: 'W', items: [{ type: 'presentation', id: 'a' }] },
      [{ id: 'a', name: 'Long Song', category: 'Worship', key: 'C', slides: [slide('one'), slide('two')] }]
    )
    expect(html).toContain('<h3>Verse 1</h3>')
    expect(html).toContain('<h3 class="cont">Verse 1 (cont.)</h3>')
    // the title and key sit in a table header, which printing repeats on each page the song runs onto
    expect(html).toMatch(/<thead>[\s\S]*Long Song[\s\S]*Key of C[\s\S]*<\/thead>/)
    expect(html).toMatch(/thead\s*\{\s*display:\s*table-header-group/)
  })

  it('lets a very long word wrap instead of running off the page', () => {
    const html = buildSetlistSheetHtml({ name: 'W', items: [] }, [])
    expect(html).toMatch(/overflow-wrap:\s*anywhere/)
    expect(html).toMatch(/white-space:\s*pre-wrap/)
  })
})
