import { describe, it, expect } from 'vitest'
import { Slide } from './Slide.js'
import { TextElement } from './TextElement.js'
import { Presentation } from './Presentation.js'

describe('TextElement', () => {
  it('applies sensible defaults', () => {
    const el = new TextElement()
    expect(el.fontSize).toBe(60)
    expect(el.fontFamily).toBe('Inter')
    expect(el.hAlign).toBe('center')
    expect(el.hasShadow).toBe(true)
  })

  it('can disable the shadow (regression: || true made it permanent)', () => {
    expect(new TextElement({ hasShadow: false }).hasShadow).toBe(false)
  })

  it('accepts zero for positional options', () => {
    const el = new TextElement({ x: 0, y: 0, shadowOffsetX: 0, shadowOffsetY: 0 })
    expect(el.x).toBe(0)
    expect(el.shadowOffsetX).toBe(0)
  })

  it('round-trips through toJSON', () => {
    const el = new TextElement({ text: 'Hi', fontSize: 88, bold: true, hasShadow: false })
    const copy = new TextElement(el.toJSON())
    expect(copy.text).toBe('Hi')
    expect(copy.fontSize).toBe(88)
    expect(copy.bold).toBe(true)
    expect(copy.hasShadow).toBe(false)
    expect(copy.id).toBe(el.id)
  })
})

describe('Slide', () => {
  it('manages text elements', () => {
    const slide = new Slide()
    const el = slide.addTextElement({ text: 'line' })
    expect(slide.elements).toHaveLength(1)
    slide.removeElement(el.id)
    expect(slide.elements).toHaveLength(0)
  })

  it('joins element text for plain-text export', () => {
    const slide = new Slide()
    slide.addTextElement({ text: 'first' })
    slide.addTextElement({ text: 'second' })
    expect(slide.getPlainText()).toBe('first\nsecond')
  })

  it('round-trips elements and background through toJSON', () => {
    const slide = new Slide({ label: 'Chorus', group: 'chorus' })
    slide.addTextElement({ text: 'lyrics', fontSize: 72 })
    const copy = new Slide(slide.toJSON())
    expect(copy.label).toBe('Chorus')
    expect(copy.elements[0]).toBeInstanceOf(TextElement)
    expect(copy.elements[0].fontSize).toBe(72)
    expect(copy.background).toEqual({ type: 'color', color: '#000000', mediaPath: null })
  })
})

describe('Presentation', () => {
  it('serializes nested slides', () => {
    const pres = new Presentation({ id: 'p1', name: 'Test' })
    const slide = new Slide({ label: 'V1' })
    slide.addTextElement({ text: 'x' })
    pres.addSlide(slide)
    const json = pres.toJSON()
    expect(json.slides[0].label).toBe('V1')
    expect(json.slides[0].elements[0].text).toBe('x')
  })
})
