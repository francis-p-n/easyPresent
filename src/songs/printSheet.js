/**
 * printSheet — printable chord sheets for a setlist.
 *
 * buildSetlistSheetHtml() is pure (playlist + presentations in, HTML out) so it
 * can be tested without a DOM; printSetlist() renders it into a hidden iframe
 * and calls print(), which works the same in Electron and a browser ("Save as
 * PDF" in the print dialog covers handing the band a file).
 */

import { makeTransposer, transposeKey, describeShift } from './transpose.js'

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const SONG_CATEGORIES = new Set(['hymns', 'worship', 'songs'])

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

/** Wide (East Asian, fullwidth, emoji) characters take two columns in a monospace font; combining marks take none. */
function charWidth(codePoint) {
  if ((codePoint >= 0x300 && codePoint <= 0x36f) || (codePoint >= 0x200b && codePoint <= 0x200f) || codePoint === 0xfe0f) return 0
  const wide =
    (codePoint >= 0x1100 && codePoint <= 0x115f) || // Hangul Jamo
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) || // CJK radicals .. Yi
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) || // Hangul syllables
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK compatibility
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) || // fullwidth forms
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff) || // emoji
    (codePoint >= 0x20000 && codePoint <= 0x3fffd) // CJK extensions
  return wide ? 2 : 1
}

/** How many monospace columns `text` takes up. */
export function displayWidth(text) {
  let width = 0
  for (const ch of String(text)) width += charWidth(ch.codePointAt(0))
  return width
}

/** The column a chord at character index `pos` of `text` belongs over. */
export function columnOf(text, pos) {
  return displayWidth(String(text).slice(0, pos))
}

/** Monospace chord row: each chord sits above the character it precedes. */
export function chordRow(chords) {
  let row = ''
  for (const c of chords) {
    const pad = Math.max(row.length > 0 ? 1 : 0, c.pos - row.length) // never touch the previous chord
    row += ' '.repeat(pad) + c.chord
  }
  return row
}

function isSong(pres) {
  if (SONG_CATEGORIES.has(String(pres.category || '').toLowerCase())) return true
  return (pres.slides || []).some((s) => (s.linesData || []).some((l) => l.chords && l.chords.length))
}

/** "Key of A (written in G, +2)" — the key to play in, and where it came from. */
function keyLabel(pres) {
  const shift = pres.transpose || 0
  if (pres.key && shift) return `Key of ${transposeKey(pres.key, shift)} (written in ${pres.key}, ${describeShift(shift)})`
  if (pres.key) return `Key of ${pres.key}`
  if (shift) return `Transposed ${describeShift(shift)} from the written key`
  return ''
}

function songHtml(pres, number, showChords) {
  const transpose = makeTransposer(pres)
  const sections = (pres.slides || [])
    .map((slide) => {
      const lines = slideLines(slide)
        .map((l) => {
          const row = showChords
            ? chordRow((l.chords || []).map((c) => ({ pos: columnOf(l.text, c.pos), chord: transpose(c.chord) })))
            : ''
          return (row ? `<div class="chords">${esc(row)}</div>` : '') + `<div class="lyric">${esc(l.text) || '&nbsp;'}</div>`
        })
        .join('')
      return `<section>${slide.label ? `<h3>${esc(slide.label)}</h3>` : ''}${lines}</section>`
    })
    .join('')
  const meta = keyLabel(pres) ? `<span class="key">${esc(keyLabel(pres))}</span>` : ''
  return `<article><h2><span class="num">${number}.</span> ${esc(pres.name)} ${meta}</h2>${sections}</article>`
}

const CSS = `
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #000; margin: 0; font-size: 12pt; }
  h1 { font-size: 20pt; margin: 0 0 2mm; }
  .sub { color: #555; margin-bottom: 8mm; font-size: 10pt; }
  .toc { margin: 0 0 8mm; padding-left: 6mm; }
  .toc li { margin: 1mm 0; }
  article { break-before: page; }
  h2 { font-size: 16pt; margin: 0 0 4mm; border-bottom: 1px solid #000; padding-bottom: 1mm; }
  h2 .key { font-size: 10pt; font-weight: normal; color: #444; margin-left: 4mm; }
  h3 { font: bold 9pt Helvetica, Arial, sans-serif; text-transform: uppercase; letter-spacing: .08em; margin: 4mm 0 1mm; color: #333; }
  section { break-inside: avoid; margin-bottom: 3mm; }
  .chords, .lyric { font-family: 'Courier New', monospace; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11pt; line-height: 1.25; }
  .chords { font-weight: bold; }
  .empty { color: #888; font-style: italic; }
`

/**
 * @param {object} playlist  { name, items:[{type:'header'|'presentation'|'note', ...}] }
 * @param {object[]} presentations
 * @param {{chords?: boolean, date?: string}} opts
 */
export function buildSetlistSheetHtml(playlist, presentations, opts = {}) {
  const showChords = opts.chords !== false
  const byId = new Map((presentations || []).map((p) => [p.id, p]))
  const songs = (playlist?.items || [])
    .filter((it) => it.type === 'presentation')
    .map((it) => byId.get(it.id))
    .filter((p) => p && isSong(p))

  const toc = songs.map((p) => `<li>${esc(p.name)}${keyLabel(p) ? ` <small>(${esc(p.transpose && p.key ? transposeKey(p.key, p.transpose) : p.key || describeShift(p.transpose))})</small>` : ''}</li>`).join('')
  const body = songs.length ? songs.map((p, i) => songHtml(p, i + 1, showChords)).join('') : '<p class="empty">No songs in this setlist.</p>'

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(playlist?.name || 'Setlist')}</title><style>${CSS}</style></head><body>
<h1>${esc(playlist?.name || 'Setlist')}</h1><div class="sub">${esc(opts.date || '')}</div>
<ol class="toc">${toc}</ol>${body}</body></html>`
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
