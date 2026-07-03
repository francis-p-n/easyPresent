import { state } from './StateManager.js'

/**
 * navigation.js — Single source of truth for slide navigation.
 *
 * Every "make slide N live" action used to be a hand-copied ritual of three
 * state.set calls (activeSlideIndex, liveSlideIndex, layers) spread across
 * keyboard, touch, click, and number-key handlers. Centralizing it here means
 * one code path, one event sequence, and no per-consumer dedup hacks.
 */

/** Make the slide at `index` live (and selected). */
export function goLive(index) {
  const pres = state.get('selectedPresentation')
  if (!pres || !pres.slides[index]) return

  state.set('activeSlideIndex', index)
  state.set('liveSlideIndex', index)

  const layers = { ...state.get('layers') }
  layers.slide = { active: true, content: pres.slides[index] }
  state.set('layers', layers)
}

/** Advance to the next slide (clamped to the end). */
export function goLiveNext() {
  const pres = state.get('selectedPresentation')
  if (!pres) return
  goLive(Math.min(state.get('liveSlideIndex') + 1, pres.slides.length - 1))
}

/** Go back to the previous slide (clamped to the start). */
export function goLivePrev() {
  goLive(Math.max(state.get('liveSlideIndex') - 1, 0))
}
