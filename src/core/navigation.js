import { state } from './StateManager.js'
import { getActiveSequence } from './arrangement.js'

/**
 * navigation.js — Single source of truth for slide navigation.
 *
 * Every "make slide N live" action used to be a hand-copied ritual of three
 * state.set calls (activeSlideIndex, liveSlideIndex, layers) spread across
 * keyboard, touch, click, and number-key handlers. Centralizing it here means
 * one code path, one event sequence, and no per-consumer dedup hacks.
 *
 * Indices here are positions in the presentation's ACTIVE ARRANGEMENT (see
 * arrangement.js), not necessarily `pres.slides` — a custom arrangement can
 * repeat a slide, so the two only coincide for the default Master arrangement.
 */

// ── Auto-advance ─────────────────────────────────────────────────────────────
// A slide can carry `autoAdvanceSec`; once it has been live that long the show moves on by
// itself. A presentation with `loop` goes back to its first slide at the end. Any way of
// changing or clearing the live slide restarts or cancels the countdown.
let autoTimer = null

const findPresentation = (id) =>
  (state.get('presentations') || []).find((p) => p.id === id) ||
  (state.get('selectedPresentation')?.id === id ? state.get('selectedPresentation') : null)

function cancelAutoAdvance() {
  clearTimeout(autoTimer)
  autoTimer = null
}

export const clampAutoSeconds = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.min(3600, Math.max(1, Math.round(Number(n)))) : 0)

function scheduleAutoAdvance(presId, index) {
  cancelAutoAdvance()
  const pres = findPresentation(presId)
  const slide = pres && getActiveSequence(pres)[index]
  const seconds = clampAutoSeconds(slide && slide.autoAdvanceSec)
  if (!seconds) return
  autoTimer = setTimeout(() => {
    autoTimer = null
    // Only act if this slide is still the live one (the operator may have moved on or cleared it)
    if (state.get('livePresentationId') !== presId || state.get('liveSlideIndex') !== index) return
    if (!state.get('layers')?.slide?.active) return
    const current = findPresentation(presId)
    if (!current) return
    const length = getActiveSequence(current).length
    if (index + 1 < length) goLiveIn(current, index + 1)
    else if (current.loop && length > 1) goLiveIn(current, 0)
  }, seconds * 1000)
}

// Clearing the slide (or the whole screen) ends any pending advance
state.on('layers', (layers) => {
  if (!layers?.slide?.active) cancelAutoAdvance()
})

/** Make slide `index` of `pres` live, whether or not `pres` is the selected song. */
function goLiveIn(pres, index) {
  const sequence = getActiveSequence(pres)
  if (!pres || !sequence[index]) return

  if (state.get('selectedPresentation')?.id === pres.id) state.set('activeSlideIndex', index)
  state.set('livePresentationId', pres.id)
  state.set('liveSlideIndex', index)

  const layers = { ...state.get('layers') }
  layers.slide = { active: true, content: sequence[index] }
  state.set('layers', layers)
  scheduleAutoAdvance(pres.id, index)
}

/** Make the slide at `index` (in the active arrangement) live and selected. */
export function goLive(index) {
  const pres = state.get('selectedPresentation')
  if (!pres) return
  goLiveIn(pres, index)
}

/**
 * True when the live position belongs to the selected song. After the operator
 * selects a different song the old slide stays on screen, but its index means
 * nothing in the new song — stepping from it would skip the new song's first slides.
 */
function liveIsInSelected(pres) {
  return state.get('livePresentationId') === pres.id
}

/** Advance to the next slide (clamped to the end). A newly selected song starts at its first slide. */
export function goLiveNext() {
  const pres = state.get('selectedPresentation')
  if (!pres) return
  if (!liveIsInSelected(pres)) return goLive(0)
  goLive(Math.min(state.get('liveSlideIndex') + 1, getActiveSequence(pres).length - 1))
}

/** Go back to the previous slide (clamped to the start). */
export function goLivePrev() {
  const pres = state.get('selectedPresentation')
  if (!pres || !liveIsInSelected(pres)) return goLive(0)
  goLive(Math.max(state.get('liveSlideIndex') - 1, 0))
}

/**
 * Take the first slide of the next (+1) or previous (-1) song in the active
 * setlist live — the keyboard way to move through a service. From a song that
 * isn't in the setlist it starts at the first song. Returns true if it moved.
 */
export function goLiveSong(direction) {
  const playlist = state.get('activePlaylist')
  const presentations = state.get('presentations') || []
  const songs = (playlist?.items || [])
    .filter((item) => item.type === 'presentation')
    .map((item) => presentations.find((p) => p.id === item.id))
    .filter(Boolean)
  if (!songs.length) return false

  const currentId = state.get('livePresentationId') || state.get('selectedPresentation')?.id
  const at = songs.findIndex((p) => p.id === currentId)
  const target = at === -1 ? songs[0] : songs[at + direction]
  if (!target) return false // already at the first / last song

  state.set('selectedPresentation', target)
  goLive(0)
  return true
}

/** Jump to slide number `n` (1-based); false if the selected song has no such slide. */
export function goLiveNumber(n) {
  const pres = state.get('selectedPresentation')
  if (!pres || !getActiveSequence(pres)[n - 1]) return false
  goLive(n - 1)
  return true
}
