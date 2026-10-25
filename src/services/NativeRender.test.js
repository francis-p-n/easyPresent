import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Tests the canvas thumbnail path of NativeRender with a recording 2D-context
 * mock (jsdom has no real canvas). PIXI-dependent paths are exercised only
 * for their "not ready" guards.
 */

function makeRecordingCanvas() {
  const calls = []
  let dataUrlCounter = 0
  const ctx = {
    calls,
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    _textAlign: 'start',
    _textBaseline: 'alphabetic',
    set textAlign(v) {
      // Mimic canvas behavior: invalid values are silently ignored
      if (['left', 'right', 'center', 'start', 'end'].includes(v)) this._textAlign = v
    },
    get textAlign() {
      return this._textAlign
    },
    set textBaseline(v) {
      if (['top', 'hanging', 'middle', 'alphabetic', 'ideographic', 'bottom'].includes(v)) this._textBaseline = v
    },
    get textBaseline() {
      return this._textBaseline
    },
    clearRect: (...a) => calls.push(['clearRect', ...a]),
    fillRect: (...a) => calls.push(['fillRect', ...a]),
    fillText: (...a) => calls.push(['fillText', ...a]),
    strokeText: (...a) => calls.push(['strokeText', ...a])
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toDataURL: (type = 'image/png') => `data:${type};fake,${dataUrlCounter++}`,
    ctx
  }
  return canvas
}

let NativeRender
let mockCanvas

beforeEach(async () => {
  vi.resetModules()
  mockCanvas = makeRecordingCanvas()
  const origCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag) =>
    tag === 'canvas' ? mockCanvas : origCreate(tag)
  )
  NativeRender = (await import('./NativeRender.js')).default
  // The import created the composite canvas; give the thumbnail path its own
  NativeRender.thumbCanvas = null
  NativeRender.thumbCache = null
  mockCanvas = makeRecordingCanvas()
})

const fillTexts = () => mockCanvas.ctx.calls.filter((c) => c[0] === 'fillText')

describe('generateThumbnailDataUrl', () => {
  it('renders each line of text once (plus shadow passes)', () => {
    NativeRender.generateThumbnailDataUrl('line one\nline two', { hasShadow: false })
    const texts = fillTexts().map((c) => c[1])
    expect(texts).toEqual(['line one', 'line two'])
  })

  it('caches identical text+style renders (LRU)', () => {
    const a = NativeRender.generateThumbnailDataUrl('same', { fontSize: 48 })
    const callsAfterFirst = mockCanvas.ctx.calls.length
    const b = NativeRender.generateThumbnailDataUrl('same', { fontSize: 48 })
    expect(b).toBe(a) // same data URL from cache
    expect(mockCanvas.ctx.calls.length).toBe(callsAfterFirst) // no re-draw
  })

  it('does not cache-collide between different styles of the same text', () => {
    const a = NativeRender.generateThumbnailDataUrl('same', { fontSize: 48 })
    const b = NativeRender.generateThumbnailDataUrl('same', { fontSize: 96 })
    expect(b).not.toBe(a)
  })

  it('honors lineSpacing when positioning lines', () => {
    NativeRender.generateThumbnailDataUrl('a\nb', { fontSize: 100, lineSpacing: 2, hasShadow: false, vAlign: 'top' })
    const ys = fillTexts().map((c) => c[3])
    // 100px at 480/1920 scale = 25px font; spacing 2 → 50px between lines
    expect(ys[1] - ys[0]).toBe(50)
  })

  it('defaults to 1.35 line spacing when none is given', () => {
    NativeRender.generateThumbnailDataUrl('a\nb', { fontSize: 100, hasShadow: false, vAlign: 'top' })
    const ys = fillTexts().map((c) => c[3])
    expect(ys[1] - ys[0]).toBeCloseTo(25 * 1.35)
  })

  it("falls back to 'left' for alignments canvas rejects (justify)", () => {
    NativeRender.generateThumbnailDataUrl('x', { hAlign: 'center' })
    expect(mockCanvas.ctx.textAlign).toBe('center')
    NativeRender.generateThumbnailDataUrl('y', { hAlign: 'justify' })
    // Must not leak the previous render's 'center'
    expect(mockCanvas.ctx.textAlign).toBe('left')
  })

  it('emits PNG for transparent text layers and JPEG otherwise', () => {
    const png = NativeRender.generateThumbnailDataUrl('t', { transparentBg: true })
    expect(png).toMatch(/^data:image\/png/)
    const jpeg = NativeRender.generateThumbnailDataUrl('t2', {})
    expect(jpeg).toMatch(/^data:image\/jpeg/)
  })

  it('draws shadow and stroke passes when styled', () => {
    NativeRender.generateThumbnailDataUrl('s', { hasShadow: true, strokeWidth: 4 })
    const kinds = mockCanvas.ctx.calls.map((c) => c[0])
    expect(kinds).toContain('strokeText')
    // shadow pass + main pass = two fillTexts for one line
    expect(fillTexts()).toHaveLength(2)
  })

  it('normalizes CSS-string font sizes from themes ("64px")', () => {
    NativeRender.generateThumbnailDataUrl('css', { fontSize: '64px', hasShadow: false })
    expect(mockCanvas.ctx.font).toContain(`${64 * (480 / 1920)}px`)
  })

  it('evicts oldest entries beyond the 300-thumbnail cap', () => {
    for (let i = 0; i < 305; i++) {
      NativeRender.generateThumbnailDataUrl(`slide ${i}`, {})
    }
    expect(NativeRender.thumbCache.size).toBeLessThanOrEqual(300)
    expect(NativeRender.thumbCache.has('slide 0 {}')).toBe(false)
  })
})

describe('PIXI-dependent guards', () => {
  it('renderSlideText before PIXI is ready does not throw', () => {
    expect(() => NativeRender.renderSlideText('text', {})).not.toThrow()
  })

  it('renderMessage before PIXI is ready does not throw', () => {
    expect(() => NativeRender.renderMessage('msg')).not.toThrow()
  })

  it('clearLayer on an uninitialized engine is a no-op', () => {
    expect(NativeRender.clearLayer(1)).toBe(true)
  })
})
