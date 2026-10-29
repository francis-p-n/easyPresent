/**
 * chordpro — ChordPro text <-> slides.
 *
 * ChordPro is the portable format charts are stored and exchanged in: plain
 * text, chords inline in square brackets (`[G]Amazing [C]grace`), sections as
 * `[Verse 1]` headers.
 */

import { isChordName } from './chordSheetParse.js'
import { markContinuations, continuesSection } from './chordLayout.js'

// Section names written in plain text ("Verse 1:" or "[Chorus]"); the matched word is the slide group
const SECTION_WORD =
  /^\[?(Verse|Chorus|Bridge|Pre-Chorus|Intro|Outro|Tag|Interlude|Instrumental|Refrain|Ending|Coda)(?:[\s:]+(.+))?\]?:?$/i

// Indonesian headings written bare ("Bait 1", "Reff:"). Stricter than the English list — only an
// optional number or letter may follow — so a lyric line that starts with "Bait" is not mistaken for a header.
const LOCAL_SECTION_WORD = /^\[?(Bait|Reff|Refrein|Pra-?\s?Reff|Jembatan|Akhir)(?:[\s:]+(\d+|[a-z]))?\]?:?$/i

// Names in other languages that map onto the same groups, so "[Bait 1]" / "[Reff]" / "[副歌]" sort and colour like their English twins
const GROUP_HINTS = [
  [/pre-?\s?chorus|pra-?\s?reff/i, 'pre-chorus'],
  [/chorus|reff|refrain|副歌|후렴|ritornello/i, 'chorus'],
  [/verse|bait|主歌|절|couplet|strofa/i, 'verse'],
  [/bridge|jembatan|桥|브릿지|pont/i, 'bridge'],
  [/intro|前奏/i, 'intro'],
  [/outro|ending|coda|尾奏|akhir/i, 'outro'],
  [/instrumental|interlude|间奏|interlud/i, 'instrumental'],
  [/tag/i, 'tag']
]

function groupFor(label) {
  const hit = GROUP_HINTS.find(([re]) => re.test(label))
  return hit ? hit[1] : 'verse'
}

// `Title: Name`, `Category: Worship`, `Key: G` or the ChordPro form `{title: Name}`
const META_LINE = /^\{?\s*(title|t|category|key|artist|subtitle|st|tempo|capo)\s*[:=]\s*(.*?)\s*\}?$/i
const META_NAMES = { t: 'title', st: 'subtitle' }
const DIRECTIVE_LINE = /^\{[^}]*\}$/ // any other {...} directive: not lyrics

/**
 * Parses ChordPro text into slides plus any song details found in it.
 * `meta` is { title?, category?, key?, ... } from `Title:` / `{title: ...}` lines.
 *
 * Chord-only lines (an instrumental or interlude written as `[G] [D] [Em]`)
 * become a slide of their own with empty text: the audience sees a blank
 * screen while the chart and the printed sheet keep the chords.
 */
export function parseChordProSong(text, maxLines = 4) {
  const lines = text.split(/\r?\n/)
  const slides = []
  const meta = {}

  let currentGroup = 'verse'
  let currentLabel = 'Verse 1'
  let currentTextLines = []
  let currentLineData = [] // { text, chords: [{pos, chord}] }, one per text line

  const commitSlide = () => {
    if (currentLineData.length > 0) {
      const chordOnly = currentTextLines.every((t) => t === '')
      slides.push({
        id: 'slide-' + Math.random().toString(36).substr(2, 9),
        group: currentGroup,
        label: currentLabel,
        text: chordOnly ? '' : currentTextLines.join('\n'),
        linesData: currentLineData
      })
      currentTextLines = []
      currentLineData = []
    }
  }

  const startSection = (group, label) => {
    commitSlide()
    currentGroup = group
    currentLabel = label
  }

  lines.forEach((line) => {
    const trimmed = line.trim()

    const metaMatch = trimmed.match(META_LINE)
    if (metaMatch) {
      const name = metaMatch[1].toLowerCase()
      meta[META_NAMES[name] || name] = metaMatch[2]
      return
    }
    if (DIRECTIVE_LINE.test(trimmed)) return

    // Header: a known section word, or any line that is just one bracket that isn't a chord
    const wordMatch = trimmed.match(SECTION_WORD)
    const lone = trimmed.match(/^\[([^\]]+)\]$/)
    const localMatch = !wordMatch && trimmed.match(LOCAL_SECTION_WORD)
    if (wordMatch) {
      startSection(wordMatch[1].toLowerCase(), wordMatch[0].replace(/[[\]]/g, ''))
    } else if (localMatch) {
      const label = trimmed.replace(/[[\]]/g, '').replace(/:$/, '').trim()
      startSection(groupFor(label), label)
    } else if (lone && !isChordName(lone[1].trim())) {
      startSection(groupFor(lone[1]), lone[1].trim())
    } else if (trimmed === '') {
      // Blank line means new slide within the same group
      commitSlide()
    } else {
      // Parse chords from line (e.g., "[C]Amazing [F]grace")
      let cleanText = ''
      let chords = []
      let chordRegex = /\[(.*?)\]/g
      let match
      let lastIdx = 0
      let textOffset = 0

      while ((match = chordRegex.exec(trimmed)) !== null) {
        cleanText += trimmed.substring(lastIdx, match.index)
        textOffset += match.index - lastIdx
        chords.push({ pos: textOffset, chord: match[1] })
        lastIdx = chordRegex.lastIndex
      }
      cleanText += trimmed.substring(lastIdx)

      if (chords.length && cleanText.trim() === '') {
        // Chords with no words under them: keep the chords, show no text
        currentTextLines.push('')
        // No words to sit above, so lay the chords out left to right with a space between
        let at = 0
        const spaced = chords.map((c) => {
          const placed = { pos: at, chord: c.chord }
          at += c.chord.length + 1
          return placed
        })
        currentLineData.push({ text: '', chords: spaced })
      } else {
        currentTextLines.push(cleanText)
        currentLineData.push({ text: cleanText, chords })
      }

      // Auto-split slides if exceeding max lines (best practice)
      if (currentTextLines.length >= maxLines) {
        commitSlide()
      }
    }
  })

  commitSlide()
  markContinuations(slides)
  return { meta, slides }
}

/**
 * Takes out the slides that have chords but no words: an intro, a tag, an instrumental break. They would
 * otherwise be a blank screen when the operator presses Next. Returns the remaining slides and the labels
 * of the ones left out.
 */
export function withoutChordOnlySlides(slides) {
  const kept = []
  const left = []
  for (const slide of slides || []) {
    if (String(slide.text || '').trim() === '') left.push(slide.label || 'Instrumental')
    else kept.push(slide)
  }
  markContinuations(kept) // a section split around a removed slide is no longer a continuation of it
  return { slides: kept, leftOut: left }
}

/** Just the slides (see parseChordProSong for the song details too). */
export function parseChordProToSlides(text, maxLines = 4) {
  return parseChordProSong(text, maxLines).slides
}

/**
 * The inverse of parseChordProToSlides: a presentation's slides back to
 * ChordPro (one header per slide label, blank line between slides), so a
 * chart can be stored in the database and rebuilt into identical slides.
 */
export function slidesToChordPro(slides) {
  return (slides || [])
    .map((slide, i, all) => {
      const source = slide.linesData && slide.linesData.length
        ? slide.linesData
        : String(slide.text || '').split(NEWLINE).map((text) => ({ text, chords: [] }))
      const lines = source.map((l) => withInlineChords(l.text, l.chords || []))
      // A slide that carries on the section above has no header of its own: the blank line is enough,
      // and it reads back as a continuation rather than a second section with the same name
      const header = slide.label && !continuesSection(all, i) ? `[${slide.label}]${NEWLINE}` : ''
      return header + lines.join(NEWLINE)
    })
    .join(NEWLINE + NEWLINE)
}

const NEWLINE = String.fromCharCode(10)

/**
 * One slide as ChordPro text (`[G]word [C]word` per line). `mapChord` can change
 * each chord on the way out, e.g. to the key the singer asked for.
 */
export function slideToChordProText(slide, mapChord = (chord) => chord) {
  const lines =
    slide.linesData && slide.linesData.length
      ? slide.linesData
      : String(slide.text || '')
          .split(NEWLINE)
          .map((text) => ({ text, chords: [] }))
  return lines
    .map((l) => withInlineChords(l.text, (l.chords || []).map((c) => ({ ...c, chord: mapChord(c.chord) }))))
    .join(NEWLINE)
}

function withInlineChords(text, chords) {
  let out = ''
  let last = 0
  for (const c of [...chords].sort((x, y) => x.pos - y.pos)) {
    const pos = Math.min(c.pos, text.length)
    out += text.slice(last, pos) + `[${c.chord}]`
    last = pos
  }
  return out + text.slice(last)
}
