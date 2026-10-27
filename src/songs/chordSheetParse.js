/**
 * chordSheetParse — converts the common "chords on the line above the lyrics"
 * layout (as pasted from chord sites) into inline ChordPro (`[G]Amazing`), the
 * format parseChordProToSlides() and the Import Song dialog understand.
 *
 * Rules:
 *  - a line whose every token is a chord (or "x2") is a chord line
 *  - a chord line followed by a lyric line is merged into it, each chord
 *    landing at the column it sat over (chords past the end go on the end)
 *  - chord-only lines with no lyric under them (intros, interludes) are
 *    dropped, and so is a section header left with nothing under it
 *  - " - " between syllables ("Ho - san - na") is collapsed to "Hosanna"
 */

const CHORD = /^[A-G][#b]?(?:maj|min|dim|aug|sus|add|m|M)?\d*(?:sus\d?|add\d+)?(?:\/[A-G][#b]?)?$/
const REPEAT = /^[xX]\d+$/

/** True for a single chord name such as Am7, F#m, G/B, Dsus4, C6/E. */
export function isChordName(token) {
  return CHORD.test(token)
}

export function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  return tokens.length > 0 && tokens.every((t) => CHORD.test(t) || REPEAT.test(t))
}

// "[Chorus]", or a bare "Verse 2:" / "Bait 1" / "Reff:" on its own line
const BARE_HEADER = /^\s*(Verse|Chorus|Bridge|Pre-?\s?Chorus|Intro|Outro|Tag|Interlude|Instrumental|Refrain|Ending|Coda|Bait|Reff|Refrein|Pra-?\s?Reff|Jembatan|Akhir)(?:[\s:]+(\d+|[a-z]))?:?\s*$/i
const isHeader = (line) => /^\s*\[[^\]]+\]\s*$/.test(line) || BARE_HEADER.test(line)

/** Collapse " - " (and " -" at word joins) between letters; returns text + old→new column map. */
function collapseSyllables(text) {
  let out = ''
  const map = new Array(text.length + 1)
  for (let i = 0; i < text.length; i++) {
    const m = /^ - (?=[A-Za-z])/.exec(text.slice(i))
    if (m && i > 0 && /[A-Za-z]/.test(text[i - 1])) {
      for (let k = 0; k < m[0].length; k++) map[i + k] = out.length
      i += m[0].length - 1
      continue
    }
    map[i] = out.length
    out += text[i]
  }
  map[text.length] = out.length
  return { text: out, map }
}

function merge(chordLine, lyricLine) {
  const { text, map } = collapseSyllables(lyricLine.replace(/\s+$/, ''))
  const chords = []
  for (const m of chordLine.matchAll(/\S+/g)) {
    if (REPEAT.test(m[0])) continue
    const col = Math.min(m.index, lyricLine.length)
    chords.push({ pos: Math.min(map[col] ?? text.length, text.length), chord: m[0] })
  }
  let result = ''
  let last = 0
  for (const c of chords) {
    result += text.slice(last, c.pos) + `[${c.chord}]`
    last = c.pos
  }
  return result + text.slice(last)
}

/** True when the text is the "chords on the line above the words" layout. */
export function looksLikeChordsOverLyrics(source) {
  const lines = source.split(/\r?\n/)
  return lines.some(
    (line, i) =>
      isChordLine(line) &&
      lines[i + 1] !== undefined &&
      lines[i + 1].trim() !== '' &&
      !isHeader(lines[i + 1]) &&
      !isChordLine(lines[i + 1])
  )
}

/**
 * @param {string} source  chords-over-lyrics text
 * @param {{ keepInstrumental?: boolean }} [options]  keep chord-only lines (intro, interlude)
 *   as `[G] [D]` lines instead of dropping them
 */
export function chordsOverLyricsToChordPro(source, { keepInstrumental = false } = {}) {
  const lines = source.split(/\r?\n/)
  const out = []
  let pendingHeader = null
  let sectionHasLyrics = false

  const flushHeader = () => {
    if (pendingHeader !== null) {
      out.push(pendingHeader)
      pendingHeader = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isHeader(line)) {
      pendingHeader = line.trim()
      sectionHasLyrics = false
      // keep a blank line between sections once something has been emitted
      continue
    }
    if (line.trim() === '') {
      if (out.length && out[out.length - 1] !== '' && (pendingHeader === null || sectionHasLyrics)) out.push('')
      continue
    }
    if (isChordLine(line)) {
      const next = lines[i + 1]
      if (next !== undefined && next.trim() !== '' && !isHeader(next) && !isChordLine(next)) {
        flushHeader()
        sectionHasLyrics = true
        out.push(merge(line, next))
        i++
      }
      else if (keepInstrumental) {
        // a chord-only line (intro/interlude): keep it as bracketed chords
        const chords = line.trim().split(/\s+/).filter((t) => !REPEAT.test(t))
        if (chords.length) {
          flushHeader()
          sectionHasLyrics = true
          out.push(chords.map((c) => `[${c}]`).join(' '))
        }
      }
      continue
    }
    flushHeader()
    sectionHasLyrics = true
    out.push(line.replace(/\s+$/, ''))
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  // A blank line right before a header is what separates sections for the importer
  return out
    .reduce((acc, l) => {
      if (isHeader(l) && acc.length && acc[acc.length - 1] !== '') acc.push('')
      acc.push(l)
      return acc
    }, [])
    .join('\n')
}
