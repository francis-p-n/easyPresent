/**
 * arrangement.js — resolves a presentation's active arrangement into an
 * ordered slide sequence.
 *
 * ProPresenter's "arrangement" concept: a named, ordered sequence of slide
 * references that can repeat a slide (e.g. Verse 1, Chorus, Verse 2, Chorus,
 * Bridge, Chorus) without duplicating the underlying slide data. A
 * presentation always has an implicit "Master" arrangement — the slides in
 * their stored order — even if it never explicitly defines one; that keeps
 * every existing presentation (and every consumer that reads `pres.slides`
 * directly) working unchanged until the user opts into a custom arrangement.
 */

export const MASTER_ARRANGEMENT_ID = 'master'

/** The presentation's arrangements, synthesizing a Master one if none is stored. */
export function getArrangements(pres) {
  if (!pres) return []
  if (Array.isArray(pres.arrangements) && pres.arrangements.length > 0) return pres.arrangements
  return [{ id: MASTER_ARRANGEMENT_ID, name: 'Master', sequence: (pres.slides || []).map((s) => s.id) }]
}

/** The id of the arrangement that should be live — defaults to Master. */
export function getActiveArrangementId(pres) {
  return (pres && pres.activeArrangementId) || MASTER_ARRANGEMENT_ID
}

/**
 * The ordered list of slide objects to show/navigate, per the active
 * arrangement. A slide referenced more than once appears more than once in
 * the result (same object reference each time — it's one underlying slide).
 */
export function getActiveSequence(pres) {
  if (!pres || !Array.isArray(pres.slides)) return []

  const activeId = getActiveArrangementId(pres)

  // Fast path — also the correctness path: Master is never resolved through
  // a stored `sequence`, it's *defined* as pres.slides in order. Skipping
  // the id-remapping dance here also avoids an allocation on every render
  // and every goLive/goLiveNext/goLivePrev call in the (overwhelmingly
  // common) case where the presentation has no custom arrangement.
  if (activeId === MASTER_ARRANGEMENT_ID) return pres.slides

  const arrangement = (pres.arrangements || []).find((a) => a.id === activeId)
  // Stale/missing active arrangement (e.g. deleted elsewhere) — fall back to
  // Master rather than silently landing on some other arbitrary arrangement
  if (!arrangement) return pres.slides

  const byId = new Map(pres.slides.map((s) => [s.id, s]))
  const resolved = arrangement.sequence.map((id) => byId.get(id)).filter(Boolean)

  // Defensive fallback: don't strand the user on a blank grid if every
  // referenced id went stale (e.g. all its slides were deleted elsewhere)
  return resolved.length > 0 ? resolved : pres.slides
}

/** Creates a new empty custom arrangement. Returns the updated array and the new id. */
export function createArrangement(arrangements, name) {
  const id = 'arr-' + Math.random().toString(36).slice(2, 10)
  return {
    arrangements: [...arrangements, { id, name: name || 'New Arrangement', sequence: [] }],
    newId: id
  }
}

/** Master can't be deleted — it's the reference to the slide list itself. */
export function deleteArrangement(arrangements, id) {
  if (id === MASTER_ARRANGEMENT_ID) return arrangements
  return arrangements.filter((a) => a.id !== id)
}

export function renameArrangement(arrangements, id, name) {
  return arrangements.map((a) => (a.id === id ? { ...a, name } : a))
}

export function setArrangementSequence(arrangements, id, sequence) {
  return arrangements.map((a) => (a.id === id ? { ...a, sequence: [...sequence] } : a))
}
