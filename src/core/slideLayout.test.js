import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  fillRectStyle,
  imageFrameStyle,
  shapeTransform,
  hasLayout,
  renderSlideLayout
} from './slideLayout.js'

describe('fillRectStyle', () => {
  it('defaults to a full stretch when no fill is given', () => {
    expect(fillRectStyle(null)).toEqual({ left: 0, top: 0, width: 100, height: 100 })
  })

  it('converts positive insets (1000ths of a percent) into an inner box', () => {
    expect(fillRectStyle({ l: 10000, t: 20000, r: 30000, b: 5000 })).toEqual({
      left: 10, top: 20, width: 60, height: 75
    })
  })

  it('converts negative insets into an oversized (zoomed) image box', () => {
    const f = fillRectStyle({ l: -50000, t: 0, r: -50000, b: 0 })
    expect(f.left).toBe(-50)
    expect(f.width).toBe(200)
  })
})

describe('imageFrameStyle (srcRect crop composition)', () => {
  it('returns the plain fillRect frame when there is no crop', () => {
    expect(imageFrameStyle(null, null)).toEqual({ left: 0, top: 0, width: 100, height: 100 })
  })

  it('enlarges and shifts the image so the cropped region fills the box', () => {
    // Crop away the left 25% and right 25% → visible middle half must fill
    // the box: image is 200% wide shifted left by 50%.
    const f = imageFrameStyle(null, { l: 25000, t: 0, r: 25000, b: 0 })
    expect(f.width).toBeCloseTo(200)
    expect(f.left).toBeCloseTo(-50)
    expect(f.height).toBeCloseTo(100)
    expect(f.top).toBeCloseTo(0)
  })

  it('composes a crop with a fillRect frame', () => {
    // fillRect places the (cropped) image in the right half of the shape;
    // the crop doubles the underlying image width within that frame.
    const f = imageFrameStyle({ l: 50000, t: 0, r: 0, b: 0 }, { l: 25000, t: 0, r: 25000, b: 0 })
    expect(f.width).toBeCloseTo(100) // 50% frame / 0.5 visible fraction
    expect(f.left).toBeCloseTo(50 - 25) // frame left minus crop shift
  })

  it('ignores a degenerate crop that removes the whole image', () => {
    const f = imageFrameStyle(null, { l: 60000, t: 0, r: 60000, b: 0 })
    expect(f).toEqual({ left: 0, top: 0, width: 100, height: 100 })
  })
})

describe('shapeTransform', () => {
  it('returns an empty string for an untransformed shape', () => {
    expect(shapeTransform({})).toBe('')
    expect(shapeTransform()).toBe('')
  })

  it('renders rotation in degrees', () => {
    expect(shapeTransform({ rot: 45 })).toBe('rotate(45deg)')
  })

  it('renders flips as negative scales, after rotation (PPTX order)', () => {
    expect(shapeTransform({ flipH: true })).toBe('scale(-1, 1)')
    expect(shapeTransform({ rot: -10, flipH: true, flipV: true })).toBe('rotate(-10deg) scale(-1, -1)')
  })
})

describe('hasLayout', () => {
  it('is false for null, flat slides, and empty arrays', () => {
    expect(hasLayout(null)).toBe(false)
    expect(hasLayout({ text: 'plain' })).toBe(false)
    expect(hasLayout({ elements: [], images: [] })).toBe(false)
  })

  it('is true when positioned elements or images exist', () => {
    expect(hasLayout({ elements: [{ text: 'x' }] })).toBe(true)
    expect(hasLayout({ images: [{ mediaPath: 'data:...' }] })).toBe(true)
  })
})

describe('renderSlideLayout (DOM)', () => {
  let container

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => container.remove())

  const PNG = 'data:image/png;base64,AAAA'

  it('positions elements and images in container-query units of the 1920×1080 design space', () => {
    renderSlideLayout(container, {
      images: [{ mediaPath: PNG, x: 192, y: 108, width: 960, height: 540 }],
      elements: [{ text: 'Hi', x: 960, y: 540, width: 480, height: 270, fontSize: 96 }]
    })
    const layer = container.querySelector('.slide-layout-layer')
    expect(layer).not.toBeNull()
    const [imgBox, textBox] = layer.children
    expect(imgBox.style.left).toBe('10cqw') // 192/1920
    expect(imgBox.style.top).toBe('10cqh') // 108/1080
    expect(imgBox.style.width).toBe('50cqw')
    expect(textBox.style.left).toBe('50cqw')
    expect(textBox.querySelector('div').style.fontSize).toBe('5cqw') // 96/1920
  })

  it('renders images before (behind) text elements', () => {
    renderSlideLayout(container, {
      elements: [{ text: 'front', x: 0, y: 0, width: 100, height: 100 }],
      images: [{ mediaPath: PNG, x: 0, y: 0, width: 100, height: 100 }]
    })
    const layer = container.querySelector('.slide-layout-layer')
    expect(layer.children[0].querySelector('img')).not.toBeNull()
    expect(layer.children[1].textContent).toBe('front')
  })

  it('applies rotation/flip transforms and crop framing to images', () => {
    renderSlideLayout(container, {
      images: [{
        mediaPath: PNG, x: 0, y: 0, width: 100, height: 100,
        rot: 30, flipH: true, crop: { l: 25000, t: 0, r: 25000, b: 0 }
      }]
    })
    const box = container.querySelector('.slide-layout-layer').children[0]
    expect(box.style.transform).toBe('rotate(30deg) scale(-1, 1)')
    const img = box.querySelector('img')
    expect(img.style.width).toBe('200%')
    expect(img.style.left).toBe('-50%')
  })

  it('skips images with no mediaPath instead of rendering broken tags', () => {
    renderSlideLayout(container, { images: [{ mediaPath: '', x: 0, y: 0, width: 10, height: 10 }] })
    expect(container.querySelectorAll('img')).toHaveLength(0)
  })

  it('supports off-slide (negative / >100%) geometry and clips it at the layer', () => {
    renderSlideLayout(container, {
      images: [{ mediaPath: PNG, x: -192, y: -108, width: 3840, height: 540 }]
    })
    const layer = container.querySelector('.slide-layout-layer')
    expect(layer.style.overflow).toBe('hidden')
    const box = layer.children[0]
    expect(box.style.left).toBe('-10cqw')
    expect(box.style.top).toBe('-10cqh')
    expect(box.style.width).toBe('200cqw')
  })
})

describe('fillRuns', () => {
  it('wraps only the styled ranges and keeps all the text', async () => {
    const { fillRuns } = await import('./slideLayout.js')
    const div = document.createElement('div')
    fillRuns(div, 'Praise the Lord always', [{ start: 7, end: 10, bold: true }, { start: 16, end: 22, color: '#ff0000', fontSize: 96 }], (px) => `${px / 10}cqw`)
    const spans = [...div.querySelectorAll('span')]
    expect(spans.map((s) => s.textContent)).toEqual(['the', 'always'])
    expect(spans[0].style.fontWeight).toBe('700')
    expect(spans[1].style.fontSize).toBe('9.6cqw')
    expect(div.textContent).toBe('Praise the Lord always')
  })

  it('is plain text with no runs', async () => {
    const { fillRuns } = await import('./slideLayout.js')
    const div = document.createElement('div')
    fillRuns(div, 'Hello', undefined, String)
    expect(div.innerHTML).toBe('Hello')
  })
})
