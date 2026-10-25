import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state } from '../../core/StateManager.js'
import NativeRender from '../../services/NativeRender.js'
import { SlideView } from './SlideView.js'

/**
 * Focused coverage for how SlideView reflects a custom arrangement: the grid
 * must render the arrangement's sequence (including repeats) rather than
 * pres.slides directly, and clicking a thumbnail must go live on the correct
 * occurrence.
 */

const makePres = (overrides = {}) => ({
  id: 'pres-1',
  name: 'Test Song',
  slides: [
    { id: 's1', label: 'Verse 1', text: 'v1' },
    { id: 's2', label: 'Chorus', text: 'c' },
    { id: 's3', label: 'Bridge', text: 'b' }
  ],
  ...overrides
})

let container, _view

beforeEach(() => {
  // jsdom has no real canvas 2D context — stub the thumbnail renderer so the
  // grid can build without touching it; this test cares about grid
  // structure/navigation, not pixel output (covered by NativeRender.test.js)
  vi.spyOn(NativeRender, 'generateThumbnailDataUrl').mockReturnValue('data:image/png;base64,stub')

  container = document.createElement('div')
  document.body.appendChild(container)
  state.set('activeSlideIndex', -1)
  state.set('liveSlideIndex', -1)
  const layers = { ...state.get('layers') }
  layers.slide = { active: false, content: null }
  state.set('layers', layers)
})

afterEach(() => {
  container.remove()
  vi.restoreAllMocks()
})

describe('SlideView — default (no custom arrangement)', () => {
  it('renders one thumbnail per master slide, in master order', () => {
    state.set('selectedPresentation', makePres())
    _view = new SlideView(container)
    const labels = [...container.querySelectorAll('.slide-thumbnail__label')].map((l) => l.textContent)
    expect(labels).toEqual(['Verse 1', 'Chorus', 'Bridge'])
  })

  it('slide count reflects the master slide count', () => {
    state.set('selectedPresentation', makePres())
    _view = new SlideView(container)
    expect(container.querySelector('.slide-view-header .text-muted').textContent).toBe('3 slides')
  })
})

describe('SlideView — custom arrangement with repeats', () => {
  const withArrangement = () =>
    makePres({
      arrangements: [{ id: 'arr-1', name: 'Set', sequence: ['s2', 's1', 's2', 's3', 's2'] }],
      activeArrangementId: 'arr-1'
    })

  it('renders thumbnails in arrangement order, repeating a slide as separate tiles', () => {
    state.set('selectedPresentation', withArrangement())
    _view = new SlideView(container)
    const labels = [...container.querySelectorAll('.slide-thumbnail__label')].map((l) => l.textContent)
    expect(labels).toEqual(['Chorus', 'Verse 1', 'Chorus', 'Bridge', 'Chorus'])
  })

  it('slide count reflects the arrangement length, not the master slide count', () => {
    state.set('selectedPresentation', withArrangement())
    _view = new SlideView(container)
    expect(container.querySelector('.slide-view-header .text-muted').textContent).toBe('5 slides')
  })

  it('clicking a repeated occurrence goes live on that arrangement position', () => {
    state.set('selectedPresentation', withArrangement())
    _view = new SlideView(container)
    container.querySelectorAll('.slide-thumbnail')[4].click() // 5th tile: the last "Chorus"
    expect(state.get('liveSlideIndex')).toBe(4)
    expect(state.get('layers').slide.content.id).toBe('s2')
  })

  it('the live/active highlight lands on the correct occurrence, not just the first match', () => {
    state.set('selectedPresentation', withArrangement())
    _view = new SlideView(container)
    container.querySelectorAll('.slide-thumbnail')[2].click() // 3rd tile: the middle "Chorus"
    const thumbs = container.querySelectorAll('.slide-thumbnail')
    expect(thumbs[2].classList.contains('live')).toBe(true)
    expect(thumbs[0].classList.contains('live')).toBe(false)
    expect(thumbs[4].classList.contains('live')).toBe(false)
  })
})

describe('SlideView — Arrangement button visibility', () => {
  it('shows the Arrangement button when the presentation has slides', () => {
    state.set('selectedPresentation', makePres())
    _view = new SlideView(container)
    expect(container.querySelector('#arrangement-btn')).not.toBeNull()
  })

  it('hides it when no presentation is selected', () => {
    state.set('selectedPresentation', null)
    _view = new SlideView(container)
    expect(container.querySelector('#arrangement-btn')).toBeNull()
  })
})
