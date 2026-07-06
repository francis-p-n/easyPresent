import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { state } from '../../engine/StateManager.js'
import NativeRender from '../../engine/NativeRender.js'
import { PreviewPanel } from './PreviewPanel.js'

/**
 * A single panel is shared across tests: PreviewPanel subscribes to state and
 * never unsubscribes, so one instance per test would leave stale listeners
 * double-rendering into the same spies.
 */
let renderSlideText, renderMessage, clearLayer, container, panel

const setSlideLayer = (content, { active = true } = {}) => {
  const layers = { ...state.get('layers') }
  layers.slide = { active, content }
  state.set('layers', layers)
}

const setMessageLayer = (content, active = true) => {
  const layers = { ...state.get('layers') }
  layers.message = { active, content }
  state.set('layers', layers)
}

beforeEach(() => {
  renderSlideText = vi.spyOn(NativeRender, 'renderSlideText').mockImplementation(() => {})
  renderMessage = vi.spyOn(NativeRender, 'renderMessage').mockImplementation(() => {})
  clearLayer = vi.spyOn(NativeRender, 'clearLayer').mockImplementation(() => true)
  vi.spyOn(NativeRender, 'compositeLayers').mockImplementation(() => true)

  // Reset layers to a known inactive state (triggers a repaint on the panel)
  const layers = { ...state.get('layers') }
  layers.slide = { active: false, content: null }
  layers.message = { active: false, content: null }
  state.set('layers', layers)

  if (!panel) {
    container = document.createElement('div')
    document.body.appendChild(container)
    panel = new PreviewPanel(container)
  }

  vi.clearAllMocks() // discard constructor/reset-time calls
})

afterAll(() => {
  vi.restoreAllMocks()
  container.remove()
})

describe('PreviewPanel — slide rendering', () => {
  it('renders live slide text through the engine and flips status to LIVE', () => {
    setSlideLayer({ id: 's1', text: 'Hello world' })
    expect(renderSlideText).toHaveBeenCalledTimes(1)
    expect(renderSlideText.mock.calls[0][0]).toBe('Hello world')
    expect(container.querySelector('#preview-status').textContent).toBe('LIVE')
  })

  it('merges per-slide style over theme styles (import fidelity)', () => {
    setSlideLayer({ id: 's1', text: 'Styled', style: { fontSize: 84, color: '#FFFF00', hAlign: 'left' } })
    const styleOpts = renderSlideText.mock.calls[0][1]
    expect(styleOpts.fontSize).toBe(84)
    expect(styleOpts.color).toBe('#FFFF00')
    expect(styleOpts.hAlign).toBe('left')
  })

  it('skips redundant repaints for an identical slide (dedup)', () => {
    setSlideLayer({ id: 's1', text: 'Same' })
    setSlideLayer({ id: 's1', text: 'Same' })
    expect(renderSlideText).toHaveBeenCalledTimes(1)
  })

  it('repaints when only the per-slide style changes (regression)', () => {
    setSlideLayer({ id: 's1', text: 'Same', style: { fontSize: 48 } })
    setSlideLayer({ id: 's2', text: 'Same', style: { fontSize: 96 } })
    expect(renderSlideText).toHaveBeenCalledTimes(2)
  })

  it('clears the slide layer and shows IDLE when nothing is live', () => {
    setSlideLayer({ id: 's1', text: 'On air' })
    setSlideLayer(null, { active: false })
    expect(clearLayer).toHaveBeenCalledWith(1)
    expect(container.querySelector('#preview-status').textContent).toBe('IDLE')
  })
})

describe('PreviewPanel — message overlay', () => {
  it('renders active messages through the engine (regression: was a dead code path)', () => {
    setSlideLayer({ id: 's1', text: 'Slide' })
    setMessageLayer('Please silence your phones')
    expect(renderMessage).toHaveBeenCalledWith('Please silence your phones')
  })

  it('substitutes the {timer} token', () => {
    state.set('timer_main', '04:59')
    setSlideLayer({ id: 's1', text: 'Slide' })
    setMessageLayer('Service starting in {timer}')
    expect(renderMessage).toHaveBeenCalledWith('Service starting in 04:59')
  })

  it('shows messages even when no slide is live', () => {
    setMessageLayer('Standalone message')
    expect(renderMessage).toHaveBeenCalledWith('Standalone message')
  })

  it('clears the message layer when the message is hidden', () => {
    setSlideLayer({ id: 's1', text: 'Slide' })
    setMessageLayer('Visible')
    renderMessage.mockClear()
    setMessageLayer(null, false)
    expect(renderMessage).toHaveBeenCalledWith(null)
  })
})

describe('PreviewPanel — theme reactivity (regression: editing the active theme never repainted)', () => {
  const baseThemes = () => [
    { id: 'default', name: 'Worship Lyrics', styles: { fontFamily: 'Inter', fontSize: '64px', color: '#ffffff' } },
    { id: 'other', name: 'Other', styles: { fontFamily: 'Georgia', fontSize: '48px', color: '#00ff00' } }
  ]

  beforeEach(() => {
    state.set('themes', baseThemes())
    state.set('activeThemeId', 'default')
    setSlideLayer({ id: 's1', text: 'Themed slide' }) // no per-slide style — theme should drive rendering
    renderSlideText.mockClear()
  })

  it('repaints when switching to a different theme id', () => {
    state.set('activeThemeId', 'other')
    expect(renderSlideText).toHaveBeenCalledTimes(1)
    expect(renderSlideText.mock.calls[0][1].fontFamily).toBe('Georgia')
  })

  it('repaints when the currently-active theme is edited in place (same id, new styles)', () => {
    const themes = baseThemes()
    themes[0].styles.fontFamily = 'Comic Sans MS'
    state.set('themes', themes)
    state.set('activeThemeId', 'default') // unchanged id — the actual regression case

    expect(renderSlideText).toHaveBeenCalledTimes(1)
    expect(renderSlideText.mock.calls[0][1].fontFamily).toBe('Comic Sans MS')
  })

  it('does not repaint when re-applying identical theme styles', () => {
    state.set('themes', baseThemes()) // new array, same content
    state.set('activeThemeId', 'default')
    expect(renderSlideText).not.toHaveBeenCalled()
  })
})
