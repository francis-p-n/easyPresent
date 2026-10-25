/**
 * chordpro — ChordPro text <-> slides.
 *
 * ChordPro is the portable format charts are stored and exchanged in: plain
 * text, chords inline in square brackets (`[G]Amazing [C]grace`), sections as
 * `[Verse 1]` headers.
 */

export function parseChordProToSlides(text, maxLines = 4) {
  // Split text into blocks by blank lines or bracket headers like [Verse 1]
  const lines = text.split(/\r?\n/)
  const slides = []

  let currentGroup = 'Verse'
  let currentLabel = 'Verse 1'
  let currentTextLines = []
  let currentLineData = [] // Stores { text, chords: [{pos, chord}] }

  const commitSlide = () => {
    if (currentTextLines.length > 0) {
      slides.push({
        id: 'slide-' + Math.random().toString(36).substr(2, 9),
        group: currentGroup.toLowerCase(),
        label: currentLabel,
        text: currentTextLines.join('\n'),
        linesData: currentLineData
      })
      currentTextLines = []
      currentLineData = []
    }
  }

  lines.forEach((line) => {
    const trimmed = line.trim()

    // Check for Section Header like [Chorus] or Verse 1:
    const headerMatch = trimmed.match(
      /^\[?(Verse|Chorus|Bridge|Pre-Chorus|Intro|Outro|Tag)(?:[\s:]+(.+))?\]?:?$/i
    )

    if (headerMatch) {
      // It's a new section header
      commitSlide()
      currentGroup = headerMatch[1]
      currentLabel = headerMatch[0].replace(/[[\]]/g, '') // remove brackets for label
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

      currentTextLines.push(cleanText)
      currentLineData.push({ text: cleanText, chords })

      // Auto-split slides if exceeding max lines (best practice)
      if (currentTextLines.length >= maxLines) {
        commitSlide()
      }
    }
  })

  // Commit last
  commitSlide()

  return slides
}

/**
 * The inverse of parseChordProToSlides: a presentation's slides back to
 * ChordPro (one header per slide label, blank line between slides), so a
 * chart can be stored in the database and rebuilt into identical slides.
 */
export function slidesToChordPro(slides) {
  return (slides || [])
    .map((slide) => {
      const source = slide.linesData && slide.linesData.length
        ? slide.linesData
        : String(slide.text || '').split(NEWLINE).map((text) => ({ text, chords: [] }))
      const lines = source.map((l) => withInlineChords(l.text, l.chords || []))
      const header = slide.label ? `[${slide.label}]${NEWLINE}` : ''
      return header + lines.join(NEWLINE)
    })
    .join(NEWLINE + NEWLINE)
}

const NEWLINE = String.fromCharCode(10)

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
