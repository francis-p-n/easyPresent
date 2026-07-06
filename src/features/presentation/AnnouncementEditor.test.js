import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { state } from '../../engine/StateManager.js'
import { announcementEditor } from './AnnouncementEditor.js'

/**
 * Regression coverage for the live-sync identity fix: the editor used to
 * compare `liveSlideIndex === this.currentSlideIndex` to decide whether to
 * push an edit into the live output. That only works when a slide's position
 * in pres.slides matches its position in whatever's currently live — true
 * for the default Master arrangement, false once a custom arrangement can
 * put the same slide at a different sequence position (see arrangement.js).
 * The fix compares slide *identity* (id) instead.
 */

const makePres = () => ({
  id: 'pres-1',
  name: 'Announcements',
  slides: [
    { id: 's1', type: 'announcement', text: 'Old headline', announcementData: { headline: 'Old headline' } },
    { id: 's2', type: 'worship', text: 'Some lyric' }
  ]
})

beforeEach(() => {
  const pres = makePres()
  state.set('presentations', [pres])
  state.set('selectedPresentation', pres)
})

afterEach(() => {
  announcementEditor.close()
})

const panel = () => document.getElementById('announcement-editor-overlay')

function fillAndSave(headline) {
  panel().querySelector('#ann-headline').value = headline
  panel().querySelector('#ann-save').click()
}

describe('AnnouncementEditor — live sync', () => {
  it('pushes the edit to the live layer when the edited slide (by id) is currently live', () => {
    const pres = state.get('selectedPresentation')
    const layers = { ...state.get('layers') }
    layers.slide = { active: true, content: pres.slides[0] } // s1 is live
    state.set('layers', layers)
    // liveSlideIndex deliberately does NOT match currentSlideIndex — as would
    // happen if a custom arrangement put s1 at a different sequence position
    state.set('liveSlideIndex', 4)

    announcementEditor.open(0)
    fillAndSave('New headline')

    expect(state.get('layers').slide.content.text).toContain('New headline')
  })

  it('does not touch the live layer when a different slide is live', () => {
    const pres = state.get('selectedPresentation')
    const liveContent = pres.slides[1] // s2 is live, we're editing s1
    const layers = { ...state.get('layers') }
    layers.slide = { active: true, content: liveContent }
    state.set('layers', layers)
    state.set('liveSlideIndex', 0) // coincidentally matches currentSlideIndex, but wrong slide

    announcementEditor.open(0)
    fillAndSave('New headline')

    expect(state.get('layers').slide.content).toBe(liveContent) // untouched
  })

  it('still updates the presentation data even when nothing is live', () => {
    const layers = { ...state.get('layers') }
    layers.slide = { active: false, content: null }
    state.set('layers', layers)

    announcementEditor.open(0)
    fillAndSave('Saved offline')

    const saved = state.get('presentations').find((p) => p.id === 'pres-1')
    expect(saved.slides[0].text).toContain('Saved offline')
  })
})
