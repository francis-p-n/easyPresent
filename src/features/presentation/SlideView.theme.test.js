import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state } from '../../engine/StateManager.js'
import NativeRender from '../../engine/NativeRender.js'
import { SlideView } from './SlideView.js'

/**
 * Regression coverage: thumbnails bake the active theme's styles (font,
 * color, size) into the rendered image, but SlideView never listened for
 * theme changes at all — it only happened to repaint when something ELSE
 * (selectedPresentation/liveSlideIndex/activeSlideIndex) also changed.
 * Editing a theme's font and clicking Apply looked like nothing happened.
 */

const makePres = () => ({
  id: 'pres-1',
  name: 'Test Song',
  slides: [{ id: 's1', label: 'Verse 1', text: 'lyrics here' }]
})

const baseThemes = () => [
  { id: 'default', name: 'Worship', styles: { fontFamily: 'Inter', fontSize: '64px', color: '#ffffff' } },
  { id: 'other', name: 'Other', styles: { fontFamily: 'Georgia', fontSize: '48px', color: '#00ff00' } }
]

let container, _view, thumbSpy

beforeEach(() => {
  thumbSpy = vi.spyOn(NativeRender, 'generateThumbnailDataUrl').mockReturnValue('data:image/png;base64,stub')
  container = document.createElement('div')
  document.body.appendChild(container)
  state.set('selectedPresentation', makePres())
  state.set('themes', baseThemes())
  state.set('activeThemeId', 'default')
  _view = new SlideView(container)
  thumbSpy.mockClear()
})

afterEach(() => {
  container.remove()
  vi.restoreAllMocks()
})

describe('SlideView — theme reactivity', () => {
  it('re-renders thumbnails when switching to a different theme', () => {
    state.set('activeThemeId', 'other')
    expect(thumbSpy).toHaveBeenCalled()
    const lastCallStyle = thumbSpy.mock.calls.at(-1)[1]
    expect(lastCallStyle.fontFamily).toBe('Georgia')
  })

  it('re-renders thumbnails when the active theme is edited in place (same id, new styles)', () => {
    const themes = baseThemes()
    themes[0].styles.fontFamily = 'Comic Sans MS'
    state.set('themes', themes)

    expect(thumbSpy).toHaveBeenCalled()
    const lastCallStyle = thumbSpy.mock.calls.at(-1)[1]
    expect(lastCallStyle.fontFamily).toBe('Comic Sans MS')
  })
})
