import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state } from '../../core/StateManager.js'
import NativeRender from '../../services/NativeRender.js'
import { SlideView } from './SlideView.js'
import { goLive, goLiveNext, goLivePrev } from '../../core/navigation.js'

/**
 * Regression coverage for the live/active highlight in the thumbnail grid.
 *
 * Two bugs lived here, both only visible after the FIRST navigation:
 *
 * 1. The LIVE badge vanished. `_updateLiveState` was subscribed to
 *    `liveSlideIndex`, but `goLive()` writes `layers` LAST — so the handler
 *    compared the new index against the PREVIOUS slide's id, matched nothing,
 *    and cleared every badge. Nothing listened to `layers`, so it never
 *    recovered. The operator lost all indication of what was on the projector
 *    while the projector itself was updating correctly.
 *
 * 2. Stale `active` highlights accumulated. `_updateActiveState` skipped
 *    `i === liveIdx`, so the outgoing slide kept its `active` class forever and
 *    several slides looked selected at once.
 */

const makePres = () => ({
  id: 'pres-1',
  name: 'Test Song',
  slides: [
    { id: 's1', label: 'Verse 1', text: 'one' },
    { id: 's2', label: 'Verse 2', text: 'two' },
    { id: 's3', label: 'Chorus', text: 'three' }
  ]
})

let container, _view

const classesOf = () =>
  [...container.querySelectorAll('.slide-thumbnail')].map((t) => ({
    live: t.classList.contains('live'),
    active: t.classList.contains('active')
  }))
const liveIndexes = () => classesOf().flatMap((c, i) => (c.live ? [i] : []))
const activeIndexes = () => classesOf().flatMap((c, i) => (c.active ? [i] : []))

beforeEach(() => {
  vi.spyOn(NativeRender, 'generateThumbnailDataUrl').mockReturnValue('data:image/png;base64,stub')
  container = document.createElement('div')
  document.body.appendChild(container)
  state.set('layers', { ...state.get('layers'), slide: { active: false, content: null } })
  state.set('liveSlideIndex', -1)
  state.set('activeSlideIndex', -1)
  state.set('selectedPresentation', makePres())
  _view = new SlideView(container)
})

afterEach(() => {
  container.remove()
  vi.restoreAllMocks()
})

describe('SlideView — live/active highlight', () => {
  it('marks exactly the live slide after going live', () => {
    goLive(0)
    expect(liveIndexes()).toEqual([0])
  })

  it('keeps the LIVE badge on the new slide after advancing', () => {
    goLive(0)
    goLiveNext()
    expect(liveIndexes()).toEqual([1])
  })

  it('never leaves more than one slide marked live', () => {
    goLive(0)
    goLiveNext()
    goLiveNext()
    goLivePrev()
    expect(liveIndexes()).toHaveLength(1)
    expect(liveIndexes()).toEqual([1])
  })

  it('does not accumulate stale active highlights while navigating', () => {
    goLive(0)
    goLiveNext()
    goLiveNext()
    // live and active are mutually exclusive — LIVE wins on the current slide
    expect(activeIndexes()).toEqual([])
    expect(liveIndexes()).toEqual([2])
  })

  it('drops the badge when the live layer is cleared (blackout)', () => {
    goLive(1)
    expect(liveIndexes()).toEqual([1])
    state.set('layers', { ...state.get('layers'), slide: { active: false, content: null } })
    expect(liveIndexes()).toEqual([])
  })

  it('does not badge a slide that merely shares the live index in another deck', () => {
    goLive(1)
    // switch to a different presentation whose slide ids differ
    state.set('selectedPresentation', {
      id: 'pres-2',
      name: 'Other',
      slides: [
        { id: 'x1', text: 'a' },
        { id: 'x2', text: 'b' },
        { id: 'x3', text: 'c' }
      ]
    })
    expect(liveIndexes()).toEqual([])
  })
})
