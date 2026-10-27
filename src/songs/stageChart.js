import { getActiveSequence } from '../core/arrangement.js'
import { slideToChordProText } from './chordpro.js'
import { sectionLabel, markContinuations } from './chordLayout.js'
import { makeTransposer } from './transpose.js'

/**
 * The whole live song as the band reads it: every slide in the order it will be played,
 * with chords in the key the singer asked for. The Stage page shows all of it and keeps
 * the live section in view, so the band sees what is coming, not just what is on screen.
 *
 * Only text goes over the wire (no backgrounds), so this stays a few kilobytes.
 */
export function buildStageChart(pres) {
  if (!pres) return []
  const sequence = getActiveSequence(pres)
  const mapChord = makeTransposer(pres)
  markContinuations(sequence)
  return sequence.map((slide) => ({ label: sectionLabel(slide), text: slideToChordProText(slide, mapChord) }))
}
