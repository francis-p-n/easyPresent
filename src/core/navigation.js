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

/** Make the slide at `index` (in the active arrangement) live and selected. */
export function goLive(index) {
  const pres = state.get('selectedPresentation')
  const sequence = getActiveSequence(pres)
  if (!pres || !sequence[index]) return

  state.set('activeSlideIndex', index)
  state.set('liveSlideIndex', index)

  const layers = { ...state.get('layers') }
  layers.slide = { active: true, content: sequence[index] }
  state.set('layers', layers)
}

/** Advance to the next slide (clamped to the end). */
export function goLiveNext() {
  const pres = state.get('selectedPresentation')
  if (!pres) return
  goLive(Math.min(state.get('liveSlideIndex') + 1, getActiveSequence(pres).length - 1))
}

/** Go back to the previous slide (clamped to the start). */
export function goLivePrev() {
  goLive(Math.max(state.get('liveSlideIndex') - 1, 0))
}
