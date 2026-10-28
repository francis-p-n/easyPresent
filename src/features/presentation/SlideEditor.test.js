import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { state } from '../../core/StateManager.js'
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

// ---------------------------------------------------------------------------
// Positioned image layers (imported PPTX decorations)
// ---------------------------------------------------------------------------

const PNG = 'data:image/png;base64,AAAA'

const makeImagePres = () =>
  makePres({
    slides: [{
      id: 's1',
      text: 'Over art',
      type: 'worship',
      elements: [{ id: 'el1', text: 'Over art', x: 100, y: 100, width: 400, height: 200 }],
      images: [{ id: 'im1', mediaPath: PNG, x: 50, y: 60, width: 300, height: 150 }]
    }]
  })

const loadImageSlide = () => {
  const pres = makeImagePres()
  state.set('presentations', [pres])
  state.set('selectedPresentation', pres)
  state.set('activeSlideIndex', 0)
}

describe('SlideEditor — image layers', () => {
  it('renders imported image layers behind the text boxes', () => {
    loadImageSlide()
    const canvas = container.querySelector('#editor-canvas')
    const imgNode = canvas.querySelector('.editor-image')
    const textNode = canvas.querySelector('.editor-textbox')
    expect(imgNode).not.toBeNull()
    expect(imgNode.style.left).toBe('50px')
    expect(imgNode.style.top).toBe('60px')
    // DOM order = paint order: image first, text after
    expect(imgNode.compareDocumentPosition(textNode) & window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('selecting an image disables the text panel and labels the selection', () => {
    loadImageSlide()
    const imgNode = container.querySelector('.editor-image')
    imgNode.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))
    expect(container.querySelector('#box-props').style.pointerEvents).toBe('none')
    expect(container.querySelector('#selected-box-label').textContent).toContain('image 1 of 1')
  })

  it('duplicating a selected image adds an offset copy', () => {
    loadImageSlide()
    container.querySelector('.editor-image')
      .dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))
    container.querySelector('#dup-textbox-btn').click()
    const imgs = container.querySelectorAll('.editor-image')
    expect(imgs).toHaveLength(2)
  })

  it('deleting a selected image removes it, and Save persists the removal', () => {
    loadImageSlide()
    container.querySelector('.editor-image')
      .dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))
    container.querySelector('#del-textbox-btn').click()
    expect(container.querySelectorAll('.editor-image')).toHaveLength(0)

    container.querySelector('#editor-save-btn').click()
    expect(state.get('selectedPresentation').slides[0].images).toEqual([])
  })

  it('Save round-trips image layers onto the slide', () => {
    loadImageSlide()
    container.querySelector('#editor-save-btn').click()
    const saved = state.get('selectedPresentation').slides[0]
    expect(saved.images).toHaveLength(1)
    expect(saved.images[0].mediaPath).toBe(PNG)
    expect(saved.images[0].x).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// Background image controls
// ---------------------------------------------------------------------------

describe('SlideEditor — background image', () => {
  const loadBgSlide = () => {
    const pres = makePres({
      slides: [{
        id: 's1', text: 'Hello', type: 'worship',
        background: { type: 'media', color: '#000000', mediaPath: PNG }
      }]
    })
    state.set('presentations', [pres])
    state.set('selectedPresentation', pres)
    state.set('activeSlideIndex', 0)
  }

  it('shows the clear button when the slide has a background image', () => {
    loadBgSlide()
    expect(container.querySelector('#prop-bg-image-clear').style.display).toBe('block')
  })

  it('clearing the background image persists on Save (regression)', () => {
    loadBgSlide()
    container.querySelector('#prop-bg-image-clear').click()
    container.querySelector('#editor-save-btn').click()
    const bg = state.get('selectedPresentation').slides[0].background
    expect(bg.type).toBe('color')
    expect(bg.mediaPath).toBeUndefined()
  })

  it('offers the built-in background gallery and applies a swatch on click', () => {
    loadImageSlide()
    const swatches = container.querySelectorAll('.builtin-bg-swatch')
    expect(swatches.length).toBeGreaterThanOrEqual(8)

    swatches[0].click()
    container.querySelector('#editor-save-btn').click()
    const bg = state.get('selectedPresentation').slides[0].background
    expect(bg.type).toBe('media')
    expect(bg.mediaPath).toMatch(/^data:image\/svg\+xml/)
  })
})

describe('SlideEditor — undo / redo', () => {
  const undoBtn = () => container.querySelector('#editor-undo-btn')
  const redoBtn = () => container.querySelector('#editor-redo-btn')
  const boxCount = () => container.querySelectorAll('.editor-textbox').length

  it('starts with nothing to undo or redo', () => {
    state.set('activeSlideIndex', 0)
    expect(undoBtn().disabled).toBe(true)
    expect(redoBtn().disabled).toBe(true)
  })

  it('undoes and redoes adding a text box', () => {
    state.set('activeSlideIndex', 0)
    const before = boxCount()
    container.querySelector('#add-textbox-btn').click()
    expect(boxCount()).toBe(before + 1)

    undoBtn().click()
    expect(boxCount()).toBe(before)
    expect(redoBtn().disabled).toBe(false)

    redoBtn().click()
    expect(boxCount()).toBe(before + 1)
  })

  it('undoes a font change and a new edit clears the redo branch', async () => {
    state.set('activeSlideIndex', 0)
    fontInput().value = 'Georgia'
    fontInput().dispatchEvent(new window.Event('input'))
    undoBtn().click() // checkpoints the pending edit, then steps back
    expect(fontInput().value).toBe('Inter')
    expect(redoBtn().disabled).toBe(false)

    container.querySelector('#add-textbox-btn').click()
    expect(redoBtn().disabled).toBe(true)
  })

  it('Ctrl+Z / Ctrl+Shift+Z drive undo and redo from the keyboard', () => {
    state.set('activeSlideIndex', 0)
    state.set('isEditing', true)
    const before = boxCount()
    container.querySelector('#add-textbox-btn').click()
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    expect(boxCount()).toBe(before)
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true }))
    expect(boxCount()).toBe(before + 1)
    state.set('isEditing', false)
  })

  it('loading another slide resets the history', () => {
    state.set('activeSlideIndex', 0)
    container.querySelector('#add-textbox-btn').click()
    expect(undoBtn().disabled).toBe(false)
    state.set('selectedPresentation', makePres({ slides: [{ id: 's1', text: 'Hello', type: 'worship' }, { id: 's2', text: 'B' }] }))
    state.set('activeSlideIndex', 1)
    expect(undoBtn().disabled).toBe(true)
  })
})
