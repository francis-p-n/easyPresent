/**
 * printSheet — printable chord sheets for a setlist.
 *
 * buildSetlistSheetHtml() is pure (playlist + presentations in, HTML out) so it
 * can be tested without a DOM; printSetlist() renders it into a hidden iframe
 * and calls print(), which works the same in Electron and a browser ("Save as
 * PDF" in the print dialog covers handing the band a file).
 */

import { makeTransposer, transposeKey, describeShift } from './transpose.js'
import { lineSegments, sectionLabel, markContinuations } from './chordLayout.js'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const SONG_CATEGORIES = new Set(['hymns', 'worship', 'songs'])
// Slides that are never read off a chord sheet. Anything else with words is treated as a song,
// chords or not, so a chart that simply has no chords yet still reaches the band's page.
const NON_SONG_CATEGORIES = new Set(['announcements', 'announcement', 'sermon', 'scripture', 'bible', 'game', 'media', 'camp'])

/** Lines of one slide as { text, chords:[{pos,chord}] }, from linesData or inline [C] markup. */
export function slideLines(slide) {
  if (slide.linesData && slide.linesData.length) return slide.linesData
  return String(slide.text || '')
    .split('\n')
    .map((raw) => {
      const chords = []
      let text = ''
      let last = 0
      for (const m of raw.matchAll(/\[(.*?)\]/g)) {
        text += raw.slice(last, m.index)
        chords.push({ pos: text.length, chord: m[1] })
        last = m.index + m[0].length
      }
      text += raw.slice(last)
      return { text, chords }
    })
}

function isSong(pres) {
  const category = String(pres.category || '').toLowerCase()
  if (SONG_CATEGORIES.has(category)) return true
  if ((pres.slides || []).some((s) => (s.linesData || []).some((l) => l.chords && l.chords.length) || /\[[^\]]+\]/.test(s.text || ''))) return true
  if (NON_SONG_CATEGORIES.has(category)) return false
  return (pres.slides || []).some((s) => String(s.text || '').trim())
}

/** "Key of A (written in G, +2)" — the key to play in, and where it came from. */
function keyLabel(pres) {
  const shift = pres.transpose || 0
  if (pres.key && shift) return `Key of ${transposeKey(pres.key, shift)} (written in ${pres.key}, ${describeShift(shift)})`
  if (pres.key) return `Key of ${pres.key}`
  if (shift) return `Transposed ${describeShift(shift)} from the written key`
  return ''
}

/** One line: each chord sits on top of the words it precedes (see chordLayout) — correct in any font or script. */
function lineHtml(line, transpose, showChords) {
  if (!showChords || !(line.chords && line.chords.length)) return `<div class="lyric">${esc(line.text) || '&nbsp;'}</div>`
  const segments = lineSegments(line, transpose)
    .map((seg) => `<span class="seg"><span class="chords">${esc(seg.chord) || '&nbsp;'}</span><span class="t">${esc(seg.text)}</span></span>`)
    .join('')
  return `<div class="ln">${segments}</div>`
}

function songHtml(pres, number, showChords) {
  const transpose = makeTransposer(pres)
  const slides = markContinuations([...(pres.slides || [])].map((s) => ({ ...s })))
  const sections = slides
    .map((slide) => {
      const lines = slideLines(slide).map((l) => lineHtml(l, transpose, showChords)).join('')
      const heading = slide.label ? `<h3${slide.cont ? ' class="cont"' : ''}>${esc(sectionLabel(slide))}</h3>` : ''
      return `<tr><td><section>${heading}${lines}</section></td></tr>`
    })
    .join('')
  const meta = keyLabel(pres) ? `<span class="key">${esc(keyLabel(pres))}</span>` : ''
  // The title row is a table header, which the print engine repeats at the top of every page the song runs onto
  return `<article><table class="song"><thead><tr><td><h2><span class="num">${number}.</span> ${esc(pres.name)} ${meta}</h2></td></tr></thead><tbody>${sections}</tbody></table></article>`
}

const CSS = `
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #000; margin: 0; font-size: 12pt; }
  h1 { font-size: 20pt; margin: 0 0 2mm; }
  .sub { color: #555; margin-bottom: 8mm; font-size: 10pt; }
  .toc { margin: 0 0 8mm; padding-left: 6mm; }
  .toc li { margin: 1mm 0; }
  article { break-inside: avoid; margin-bottom: 6mm; } /* short songs share a page; a song never starts at the very bottom of one */
  h2 { font-size: 14pt; margin: 0 0 2mm; border-bottom: 1px solid #000; padding-bottom: 1mm; }
  h2 .key { font-size: 10pt; font-weight: normal; color: #444; margin-left: 4mm; }
  h3 { font: bold 9pt Helvetica, Arial, sans-serif; text-transform: uppercase; letter-spacing: .08em; margin: 2.5mm 0 .5mm; color: #333; }
  table.song { width: 100%; border-collapse: collapse; }
  table.song td { padding: 0; }
  thead { display: table-header-group; } /* repeats the song title and key on each page of a long song */
  tr { break-inside: avoid; }
  section { margin-bottom: 1.5mm; }
  h3.cont { color: #777; font-weight: normal; }
  .lyric { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11pt; line-height: 1.2; }
  .ln { display: flex; flex-wrap: wrap; align-items: flex-end; }
  .seg { display: inline-flex; flex-direction: column; }
  .chords { font: bold 10pt Helvetica, Arial, sans-serif; white-space: pre; padding-right: .5em; min-height: 1.1em; line-height: 1.1; }
  .t { white-space: pre-wrap; font-size: 11pt; line-height: 1.2; }
  .empty { color: #888; font-style: italic; }
  .toc li.hdr, .toc li.nte, .toc li.skip { list-style: none; margin-left: -6mm; }
  .toc li.skip { color: #777; }
  h4.hdr { font: bold 12pt Helvetica, Arial, sans-serif; text-transform: uppercase; letter-spacing: .1em; margin: 6mm 0 2mm; break-after: avoid; }
  p.note { margin: 0 0 3mm; font-style: italic; color: #333; font-size: 10pt; }
`

/**
 * @param {object} playlist  { name, items:[{type:'header'|'presentation'|'note', ...}] }
 * @param {object[]} presentations
 * @param {{chords?: boolean, date?: string}} opts
 */
export function buildSetlistSheetHtml(playlist, presentations, opts = {}) {
  const showChords = opts.chords !== false
  const byId = new Map((presentations || []).map((p) => [p.id, p]))
  const items = playlist?.items || []

  // Walk the setlist in order so headers and notes stay where the operator put them,
  // and anything that is not printed is still named rather than silently dropped
  let number = 0
  const toc = []
  const pages = []
  for (const it of items) {
    if (it.type === 'header') {
      const text = esc(it.text)
      toc.push(`<li class="hdr"><strong>${text}</strong></li>`)
      pages.push(`<h4 class="hdr">${text}</h4>`)
    } else if (it.type === 'note') {
      toc.push(`<li class="nte"><em>${esc(it.text)}</em></li>`)
      pages.push(`<p class="note">${esc(it.text)}</p>`)
    } else if (it.type === 'presentation') {
      const p = byId.get(it.id)
      if (!p) {
        toc.push('<li class="skip">(song removed from the library)</li>')
      } else if (!isSong(p)) {
        toc.push(`<li class="skip">${esc(p.name)} <small>(slides only, not printed)</small></li>`)
      } else {
        number += 1
        const label = keyLabel(p) ? ` <small>(${esc(p.transpose && p.key ? transposeKey(p.key, p.transpose) : p.key || describeShift(p.transpose))})</small>` : ''
        toc.push(`<li>${esc(p.name)}${label}</li>`)
        pages.push(songHtml(p, number, showChords))
      }
    }
  }
  const body = number ? pages.join('') : '<p class="empty">No songs in this setlist.</p>'

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(playlist?.name || 'Setlist')}</title><style>${CSS}</style></head><body>
<h1>${esc(playlist?.name || 'Setlist')}</h1><div class="sub">${esc(opts.date || '')}</div>
<ol class="toc">${toc.join('')}</ol>${body}</body></html>`
}

/** Render into a hidden iframe and open the print dialog. */
export function printSetlist(playlist, presentations, opts = {}) {
  const html = buildSetlistSheetHtml(playlist, presentations, {
    date: new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    ...opts
  })
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  frame.srcdoc = html
  frame.onload = () => {
    frame.contentWindow.focus()
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 1000)
  }
}
