import { describe, it, expect, beforeEach } from 'vitest'
import { state } from './StateManager.js'
import { goLive, goLiveNext, goLivePrev } from './navigation.js'

const makePres = () => ({
  id: 'test-pres',
  name: 'Test',
  slides: [
    { id: 'a', text: 'slide a' },
    { id: 'b', text: 'slide b', style: { fontSize: 84, bold: true } },
    { id: 'c', text: 'slide c' }
  ]
})

beforeEach(() => {
  state.set('selectedPresentation', makePres())
  state.set('activeSlideIndex', -1)
  state.set('liveSlideIndex', -1)
  const layers = { ...state.get('layers') }
  layers.slide = { active: false, content: null }
  state.set('layers', layers)
})

describe('goLive', () => {
  it('sets both indices and activates the slide layer with the slide content', () => {
    goLive(1)
    expect(state.get('activeSlideIndex')).toBe(1)
    expect(state.get('liveSlideIndex')).toBe(1)
    const layer = state.get('layers').slide
    expect(layer.active).toBe(true)
    expect(layer.content.id).toBe('b')
    // Per-slide style (e.g. PPTX import) must travel with the live content
    expect(layer.content.style).toEqual({ fontSize: 84, bold: true })
  })

  it('ignores out-of-range indices', () => {
    goLive(99)
    expect(state.get('liveSlideIndex')).toBe(-1)
    expect(state.get('layers').slide.active).toBe(false)
    goLive(-1)
    expect(state.get('liveSlideIndex')).toBe(-1)
  })

  it('does nothing when no presentation is selected', () => {
    state.set('selectedPresentation', null)
    goLive(0)
    expect(state.get('liveSlideIndex')).toBe(-1)
  })
})

describe('goLiveNext / goLivePrev', () => {
  it('advances and clamps at the last slide', () => {
    goLive(1)
    goLiveNext()
    expect(state.get('liveSlideIndex')).toBe(2)
    goLiveNext()
    expect(state.get('liveSlideIndex')).toBe(2) // clamped
  })

  it('goes back and clamps at the first slide', () => {
    goLive(1)
    goLivePrev()
    expect(state.get('liveSlideIndex')).toBe(0)
    goLivePrev()
    expect(state.get('liveSlideIndex')).toBe(0) // clamped
  })
})

describe('navigation over a custom arrangement (repeated slides)', () => {
  const withArrangement = () => {
    const pres = makePres()
    pres.arrangements = [{ id: 'arr-1', name: 'Set', sequence: ['b', 'a', 'b', 'c', 'b'] }]
    pres.activeArrangementId = 'arr-1'
    state.set('selectedPresentation', pres)
    return pres
  }

  it('goLive indexes into the arrangement sequence, not pres.slides', () => {
    withArrangement()
    goLive(0)
    expect(state.get('layers').slide.content.id).toBe('b') // sequence[0], not slides[0] ('a')
  })

  it('walks repeated entries as distinct navigation steps', () => {
    withArrangement()
    goLive(0)
    expect(state.get('layers').slide.content.id).toBe('b')
    goLiveNext()
    expect(state.get('layers').slide.content.id).toBe('a')
    goLiveNext()
    expect(state.get('layers').slide.content.id).toBe('b') // repeat #2, same underlying slide
    goLiveNext()
    expect(state.get('layers').slide.content.id).toBe('c')
    goLiveNext()
    expect(state.get('layers').slide.content.id).toBe('b') // repeat #3
  })

  it('clamps at the arrangement length, not the master slide count', () => {
    withArrangement() // sequence has 5 entries, master has 3 slides
    goLive(4)
    goLiveNext()
    expect(state.get('liveSlideIndex')).toBe(4) // clamped at sequence.length - 1, not 2
  })

  it('falls back to Master (identity with pres.slides) once activeArrangementId is Master', () => {
    const pres = withArrangement()
    pres.activeArrangementId = 'master'
    state.set('selectedPresentation', { ...pres })
    goLive(1)
    expect(state.get('layers').slide.content.id).toBe('b') // slides[1], per normal order
  })
})

describe('style merge contract (defaults → theme → per-slide)', () => {
  // Mirrors the merge order used by SlideView and PreviewPanel: per-slide
  // style from an import must override theme values, and slides without a
  // style must keep theme values untouched.
  const mergeLikeRenderers = (slide, theme) => {
    const styleOpts = { fontSize: 48, bold: true, color: '#FFFFFF', hAlign: 'center' }
    if (theme && theme.styles) {
      Object.assign(styleOpts, theme.styles)
      if (theme.styles.textAlign) styleOpts.hAlign = theme.styles.textAlign
    }
    if (slide.style) Object.assign(styleOpts, slide.style)
    return styleOpts
  }

  const theme = { styles: { fontSize: '64px', color: '#EEEEEE', textAlign: 'left' } }

  it('per-slide style wins over the theme', () => {
    const slide = { text: 'x', style: { fontSize: 84, color: '#FFFF00', hAlign: 'center' } }
    const merged = mergeLikeRenderers(slide, theme)
    expect(merged.fontSize).toBe(84)
    expect(merged.color).toBe('#FFFF00')
    expect(merged.hAlign).toBe('center')
  })

  it('slides without a style keep theme values', () => {
    const merged = mergeLikeRenderers({ text: 'x' }, theme)
    expect(merged.fontSize).toBe('64px')
    expect(merged.color).toBe('#EEEEEE')
    expect(merged.hAlign).toBe('left')
  })
})

describe('StateManager.updatePresentation (copy-on-write)', () => {
  it('replaces object identities instead of mutating in place', () => {
    const before = state.get('selectedPresentation')
    state.set('presentations', [before])

    const updated = state.updatePresentation('test-pres', (p) => {
      p.slides[0].text = 'edited'
    })

    expect(updated).not.toBe(before) // fresh reference
    expect(before.slides[0].text).toBe('slide a') // original untouched
    expect(state.get('selectedPresentation').slides[0].text).toBe('edited')
  })

  it('returns null for unknown ids', () => {
    expect(state.updatePresentation('nope', () => {})).toBeNull()
  })
})
