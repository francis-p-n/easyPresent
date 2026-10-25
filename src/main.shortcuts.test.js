import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Regression: the global show shortcuts are bare keys (Escape/b/. = blackout,
 * arrows = advance, 1-9 = jump) so a clicker can drive them. They were guarded
 * only against INPUT/TEXTAREA, which meant:
 *
 *   - Escape to dismiss a context menu BLACKED OUT the audience screen.
 *   - Ctrl+B (and any other chord sharing a letter) did the same.
 *
 * The guard must stay narrow in the other direction too: #preview-layout-overlay
 * is NOT a modal — it's the layout render inside the preview panel, present the
 * whole time a PPTX slide is live. Treating it as one would kill every shortcut
 * for the rest of the service.
 */

// main.js self-bootstraps on DOMContentLoaded; importing it is fine because the
// event has already fired in jsdom by the time the module is pulled in here.
let isShowShortcutBlocked

beforeEach(async () => {
  vi.resetModules()
  ;({ isShowShortcutBlocked } = await import('./main.js'))
})

afterEach(() => {
  document.body.innerHTML = ''
})

const ev = (over = {}) => ({
  key: 'Escape',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  target: document.body,
  ...over
})

describe('isShowShortcutBlocked', () => {
  it('allows a bare key with nothing in the way', () => {
    expect(isShowShortcutBlocked(ev(), false)).toBe(false)
  })

  it('blocks while typing in an input or textarea', () => {
    expect(isShowShortcutBlocked(ev({ target: document.createElement('input') }), false)).toBe(true)
    expect(isShowShortcutBlocked(ev({ target: document.createElement('textarea') }), false)).toBe(true)
  })

  it('blocks inside a contenteditable surface', () => {
    const el = document.createElement('div')
    el.isContentEditable = true
    expect(isShowShortcutBlocked(ev({ target: el }), false)).toBe(true)
  })

  it('blocks while the slide editor owns the keyboard', () => {
    expect(isShowShortcutBlocked(ev(), true)).toBe(true)
  })

  it.each(['ctrlKey', 'metaKey', 'altKey'])('blocks the %s chord', (mod) => {
    expect(isShowShortcutBlocked(ev({ key: 'b', [mod]: true }), false)).toBe(true)
  })

  it.each([
    ['.context-menu', 'div'],
    ['.modal-overlay', 'div'],
    ['#confirm-dialog-overlay', 'div'],
    ['#rename-dialog-overlay', 'div'],
    ['#arrangement-editor-overlay', 'div'],
    ['#theme-editor-overlay', 'div']
  ])('blocks while %s is open', (selector, tag) => {
    const el = document.createElement(tag)
    if (selector.startsWith('.')) el.className = selector.slice(1)
    else el.id = selector.slice(1)
    document.body.appendChild(el)
    expect(isShowShortcutBlocked(ev(), false)).toBe(true)
  })

  it('does NOT treat #preview-layout-overlay as a modal (PPTX slide live)', () => {
    const el = document.createElement('div')
    el.id = 'preview-layout-overlay'
    document.body.appendChild(el)
    expect(isShowShortcutBlocked(ev({ key: 'ArrowRight' }), false)).toBe(false)
  })
})
