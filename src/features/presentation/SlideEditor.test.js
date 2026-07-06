import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { state } from '../../engine/StateManager.js'
import { createSlideEditor } from './SlideEditor.js'

/**
 * Focused coverage for two font-related fixes:
 *  1. The Text Box property panel had a Font Size control but no Font
 *     (family) control at all — there was no way to change a text box's
 *     font from the editor UI.
 *  2. Opening an imported PPTX slide (which stores its captured formatting
 *     on `slide.style`, not `slide.elements`) silently reset it to the
 *     generic template look — `slide.style.fontFamily`/bold/italic/etc.
 *     were never read.
 */

const makePres = (overrides = {}) => ({
  id: 'pres-1',
  name: 'Test',
  slides: [{ id: 's1', text: 'Hello', type: 'worship' }],
  ...overrides
})

let container, editor

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  state.set('selectedPresentation', makePres())
  state.set('activeSlideIndex', -1)
  const layers = { ...state.get('layers') }
  layers.slide = { active: false, content: null }
  state.set('layers', layers)
  editor = createSlideEditor(container)
})

afterEach(() => {
  editor?.destroy?.()
  container.remove()
})

const fontInput = () => container.querySelector('#prop-font-family')
const boxTextNode = () => container.querySelector('.editor-textbox__text')

describe('SlideEditor — font family control', () => {
  it('renders a Font input in the Text Box panel', () => {
    expect(fontInput()).not.toBeNull()
  })

  it('loading a slide selects its one auto-generated text box, populating the font input', () => {
    state.set('activeSlideIndex', 0)
    expect(fontInput().value).toBe('Inter') // default when the slide carries no style
  })

  it('typing a font name updates the selected text box and its on-canvas rendering', () => {
    state.set('activeSlideIndex', 0)
    fontInput().value = 'Georgia'
    fontInput().dispatchEvent(new window.Event('input'))

    expect(fontInput().value).toBe('Georgia')
    expect(boxTextNode().style.fontFamily).toContain('Georgia')
  })

  it('blank input falls back to Inter rather than an empty font-family', () => {
    state.set('activeSlideIndex', 0)
    fontInput().value = '   '
    fontInput().dispatchEvent(new window.Event('input'))
    expect(fontInput().value).toBe('Inter')
  })
})

describe('SlideEditor — imported PPTX style preservation (regression)', () => {
  it('honors slide.style.fontFamily instead of resetting to the template default', () => {
    state.set('selectedPresentation', makePres({
      slides: [{ id: 's1', text: 'Imported', type: 'worship', style: { fontFamily: 'Calibri' } }]
    }))
    state.set('activeSlideIndex', 0)
    expect(fontInput().value).toBe('Calibri')
  })

  it('honors slide.style.color, hAlign, bold, and italic together', () => {
    state.set('selectedPresentation', makePres({
      slides: [{
        id: 's1',
        text: 'Imported',
        type: 'worship',
        style: { fontFamily: 'Constantia', color: '#ffff00', hAlign: 'left', bold: true, italic: true }
      }]
    }))
    state.set('activeSlideIndex', 0)

    expect(container.querySelector('#prop-color').value.toLowerCase()).toBe('#ffff00')
    expect(container.querySelector('#prop-align').value).toBe('left')
    // Bold/italic toggle buttons highlight via inline background style when active
    expect(container.querySelector('#style-bold').style.background).not.toBe('')
    expect(container.querySelector('#style-italic').style.background).not.toBe('')
  })

  it('falls back to the template look when the imported slide specifies no style', () => {
    state.set('selectedPresentation', makePres({
      slides: [{ id: 's1', text: 'Plain', type: 'worship' }] // no `style` at all
    }))
    state.set('activeSlideIndex', 0)
    expect(fontInput().value).toBe('Inter')
    expect(container.querySelector('#prop-color').value.toLowerCase()).toBe('#ffffff')
  })
})
