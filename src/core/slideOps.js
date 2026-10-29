/**
 * slideOps — pure operations on the slides of a presentation.
 *
 * Every function returns new objects and never changes its input, so callers can hand the result
 * straight to state.set().
 */

/** A presentation always keeps at least one slide. */
export const canRemoveSlide = (pres) => !!pres && Array.isArray(pres.slides) && pres.slides.length > 1

/**
 * The presentation without slide `slideId`. The slide is also taken out of every custom arrangement
 * (an arrangement left with nothing falls back to Master, which always has the remaining slides).
 */
export function removeSlide(pres, slideId) {
  if (!pres || !Array.isArray(pres.slides) || !pres.slides.some((s) => s.id === slideId)) return pres
  const slides = pres.slides.filter((s) => s.id !== slideId)
  const next = { ...pres, slides }
  if (Array.isArray(pres.arrangements) && pres.arrangements.length) {
    const arrangements = pres.arrangements.map((a) => ({ ...a, sequence: (a.sequence || []).filter((id) => id !== slideId) }))
    next.arrangements = arrangements
    const active = arrangements.find((a) => a.id === pres.activeArrangementId)
    if (pres.activeArrangementId && (!active || active.sequence.length === 0)) delete next.activeArrangementId
  }
  return next
}

/**
 * Where a position in the slide sequence ends up once the slide at `removedIndex` is gone:
 * later positions move up one; the removed position itself is returned as -1.
 */
export function indexAfterRemoval(index, removedIndex) {
  if (!Number.isInteger(index) || index < 0) return index
  if (index === removedIndex) return -1
  return index > removedIndex ? index - 1 : index
}
