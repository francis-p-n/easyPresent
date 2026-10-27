/**
 * chordLayout — how a line of a chart is laid out, shared by the printed sheet and the on-screen chord view.
 *
 * Chords are not aligned by padding with spaces (that only works when every glyph is exactly one
 * monospace column, which fails for Japanese, Korean, Chinese, Arabic and emoji). A line is cut
 * into segments instead — each chord together with the words it sits over — and the browser lays the
 * segments out side by side with the chord on top, so alignment holds in any font and script.
 */

/**
 * One line as [{ chord, text }]: `chord` is '' for words before the first chord. A chord with no
 * words under it (an instrumental line) is a segment with empty text.
 * `mapChord` changes each chord on the way (transposing).
 */
export function lineSegments(line, mapChord = (chord) => chord) {
  const text = String(line?.text ?? '')
  const chords = [...(line?.chords || [])].sort((a, b) => a.pos - b.pos)
  if (!chords.length) return [{ chord: '', text }]

  const segments = []
  if (chords[0].pos > 0) segments.push({ chord: '', text: text.slice(0, chords[0].pos) })
  chords.forEach((c, i) => {
    // Positions past the end (the spaced-out chords of an instrumental line) have no words to sit over
    const start = Math.min(c.pos, text.length)
    const end = i + 1 < chords.length ? Math.min(chords[i + 1].pos, text.length) : text.length
    segments.push({ chord: mapChord(c.chord), text: text.slice(start, end) })
  })
  return segments
}

/** The heading to show for a slide: "Verse 1", or "Verse 1 (cont.)" when it carries on the section above. */
export function sectionLabel(slide) {
  if (!slide?.label) return ''
  return slide.cont ? `${slide.label} (cont.)` : slide.label
}

/**
 * Flags each slide that carries on the section above it (same label and group), so a long verse that was
 * split over several slides reads "Verse 1, Verse 1 (cont.)" rather than the same name twice. Safe to repeat.
 */
export function markContinuations(slides) {
  ;(slides || []).forEach((slide, i) => {
    slide.cont = continuesSection(slides, i)
  })
  return slides
}

/** Does slide `i` carry on the section of the slide before it? Worked out from the slides themselves, never from a stored flag that an edit could leave stale. */
export function continuesSection(slides, i) {
  const slide = slides[i]
  const prev = slides[i - 1]
  return !!(i > 0 && slide?.label && prev && prev.label === slide.label && (prev.group || '') === (slide.group || ''))
}
