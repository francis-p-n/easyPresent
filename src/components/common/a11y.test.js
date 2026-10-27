import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { labelControls, enhanceDialog, installA11y } from './a11y.js'

let stop

beforeEach(() => {
  document.body.innerHTML = ''
})
afterEach(() => {
  stop?.()
  stop = null
})

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('labelControls', () => {
  it('names an icon-only button from its tooltip and gives it a hover title', () => {
    document.body.innerHTML = '<button id="b" data-tooltip="Screen Configuration"><svg></svg></button>'
    labelControls(document.body)
    expect(document.getElementById('b').getAttribute('aria-label')).toBe('Screen Configuration')
  })

  it('names a search input from its placeholder and a display dropdown from its role', () => {
    document.body.innerHTML = '<input id="i" placeholder="Search..."><select id="s" data-role="pa"></select>'
    labelControls(document.body)
    expect(document.getElementById('i').getAttribute('aria-label')).toBe('Search...')
    expect(document.getElementById('s').getAttribute('aria-label')).toBe('Display for pa')
  })

  it('leaves a control that already has a name alone', () => {
    document.body.innerHTML = '<button id="b" aria-label="Mine">Visible</button><button id="c">Text</button>'
    labelControls(document.body)
    expect(document.getElementById('b').getAttribute('aria-label')).toBe('Mine')
    expect(document.getElementById('c').hasAttribute('aria-label')).toBe(false)
  })

  it('keeps the toolbar view buttons named even when their word is hidden to save space', () => {
    document.body.innerHTML = '<button class="toolbar-view-btn" data-view="bible"><svg></svg><span class="toolbar-btn-label" style="display:none">Bible</span></button>'
    labelControls(document.body)
    const b = document.querySelector('button')
    expect(b.getAttribute('aria-label')).toBe('Bible')
    expect(b.title).toBe('Bible')
  })

  it('makes a slide thumbnail reachable and describes it', () => {
    document.body.innerHTML =
      '<div class="slide-thumbnail"><span class="slide-thumbnail__label">Chorus</span><div class="slide-thumbnail__content">Some words</div><span class="slide-thumbnail__number">3</span></div>'
    labelControls(document.body)
    const t = document.querySelector('.slide-thumbnail')
    expect(t.getAttribute('tabindex')).toBe('0')
    expect(t.getAttribute('role')).toBe('button')
    expect(t.getAttribute('aria-label')).toMatch(/^Slide 3 \(Chorus\): Some words/)
  })

  it('turns a focusable-by-nothing playlist row into a tab stop', () => {
    document.body.innerHTML = '<div class="list-item playlist-item" tabindex="-1">Holy Song</div>'
    labelControls(document.body)
    expect(document.querySelector('.playlist-item').getAttribute('tabindex')).toBe('0')
  })
})

describe('installA11y', () => {
  it('labels controls that appear later', async () => {
    stop = installA11y()
    const b = document.createElement('button')
    b.dataset.tooltip = 'Late button'
    document.body.append(b)
    await tick()
    expect(b.getAttribute('aria-label')).toBe('Late button')
  })

  it('Enter presses the focused row; Space is left for "next slide"', async () => {
    stop = installA11y()
    document.body.innerHTML = '<div class="slide-thumbnail" id="t"></div>'
    const t = document.getElementById('t')
    let clicks = 0
    t.addEventListener('click', () => clicks++)
    t.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(clicks).toBe(0)
    t.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(clicks).toBe(1)
  })

  it('turns a dialog overlay that appears into a real dialog and returns focus afterwards', async () => {
    stop = installA11y()
    const opener = document.createElement('button')
    opener.textContent = 'Open'
    document.body.append(opener)
    opener.focus()

    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    overlay.innerHTML = '<div><h3>Import Song</h3><input id="title"><button>Cancel</button></div>'
    document.body.append(overlay)
    await tick()

    expect(overlay.getAttribute('role')).toBe('dialog')
    expect(overlay.getAttribute('aria-modal')).toBe('true')
    expect(overlay.getAttribute('aria-label')).toBe('Import Song')
    expect(document.activeElement.id).toBe('title') // focus moved inside

    overlay.remove()
    await tick()
    expect(document.activeElement).toBe(opener) // and back to where it was
  })
})

describe('installA11y — focus returns after a dialog that focuses itself', () => {
  it('puts focus back on the opener even if the dialog grabbed focus first', async () => {
    stop = installA11y()
    const opener = document.createElement('button')
    opener.textContent = 'Shortcuts'
    document.body.append(opener)
    opener.focus()

    const overlay = document.createElement('div')
    overlay.id = 'shortcut-help-overlay'
    overlay.innerHTML = '<h3>Keyboard shortcuts</h3><button id="close">Close</button>'
    document.body.append(overlay)
    document.getElementById('close').focus() // the dialog moves focus before the observer runs
    await tick()

    overlay.remove()
    await tick()
    expect(document.activeElement).toBe(opener)
  })
})

describe('enhanceDialog', () => {
  const make = () => {
    document.body.innerHTML = '<div id="o"><input id="a"><button id="b">Save</button><button id="c">Cancel</button></div>'
    const o = document.getElementById('o')
    enhanceDialog(o)
    return o
  }

  it('Escape presses Cancel so the dialog can clean up', () => {
    const o = make()
    let cancelled = false
    document.getElementById('c').addEventListener('click', () => (cancelled = true))
    o.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cancelled).toBe(true)
  })

  it('Escape removes a dialog that has no Cancel button', () => {
    document.body.innerHTML = '<div id="o"><input id="a"></div>'
    const o = document.getElementById('o')
    enhanceDialog(o)
    o.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.getElementById('o')).toBeNull()
  })

  it('Tab wraps from the last control to the first, and Shift+Tab the other way', () => {
    const o = make()
    const first = document.getElementById('a')
    const last = document.getElementById('c')
    last.focus()
    o.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(first)
    first.focus()
    o.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(last)
  })

  it('does nothing twice if applied again', () => {
    const o = make()
    enhanceDialog(o)
    expect(o.dataset.a11y).toBe('dialog')
  })
})
