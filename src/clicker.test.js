import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Presentation clickers are USB keyboards. Typical buttons:
 *   Logitech R400/R500/R800  Next = PageDown, Back = PageUp, Start = F5 (then Esc to end), Blank = "."
 *   Kensington / Targus      Next = ArrowRight or PageDown, Back = ArrowLeft or PageUp, Blank = "b"
 *   Cheap dongle remotes     Next = Space / Enter-less, Back = ArrowLeft, some auto-repeat when held
 * These tests press those keys through the real show key handler.
 */
let handleShowKey, state, goLive

const press = (key, over = {}) => {
  const e = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...over })
  const handled = handleShowKey(e, false)
  return { e, handled }
}

beforeEach(async () => {
  vi.resetModules()
  ;({ handleShowKey } = await import('./main.js'))
  ;({ state } = await import('./core/StateManager.js'))
  ;({ goLive } = await import('./core/navigation.js'))
  state.set('shortcutOverrides', {})
  state.set('selectedPresentation', {
    id: 'p',
    name: 'Song',
    slides: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, text: id }))
  })
  state.set('presentations', [state.get('selectedPresentation')])
  goLive(0)
})

afterEach(() => {
  document.body.innerHTML = ''
})

const index = () => state.get('liveSlideIndex')

describe('clicker: slide buttons', () => {
  it('PageDown goes forward and PageUp goes back (Logitech)', () => {
    press('PageDown')
    press('PageDown')
    expect(index()).toBe(2)
    press('PageUp')
    expect(index()).toBe(1)
  })

  it('arrow keys and Space work too (Kensington / dongle remotes)', () => {
    press('ArrowRight')
    press(' ')
    expect(index()).toBe(2)
    press('ArrowLeft')
    expect(index()).toBe(1)
  })

  it('stops at the last and first slide instead of running off the song', () => {
    for (let i = 0; i < 10; i++) press('PageDown')
    expect(index()).toBe(4)
    for (let i = 0; i < 10; i++) press('PageUp')
    expect(index()).toBe(0)
  })

  it('a held button (auto-repeat) advances only once', () => {
    press('PageDown')
    expect(index()).toBe(1)
    for (let i = 0; i < 5; i++) press('PageDown', { repeat: true })
    expect(index()).toBe(1)
  })

  it('takes the key even when a toolbar button has focus, so the button does not also fire', () => {
    const btn = document.createElement('button')
    document.body.appendChild(btn)
    btn.focus()
    const { e } = press(' ', { })
    expect(e.defaultPrevented).toBe(true)
    expect(index()).toBe(1)
  })
})

describe('clicker: blank and start/stop buttons', () => {
  const clearButton = () => {
    const btn = document.createElement('button')
    btn.id = 'clear-btn-all'
    let clicks = 0
    btn.addEventListener('click', () => clicks++)
    document.body.appendChild(btn)
    return () => clicks
  }

  it('the blank button (. or b) and Esc clear the screen', () => {
    const clicks = clearButton()
    press('.')
    press('b')
    press('Escape')
    expect(clicks()).toBe(3)
  })

  it('"start slideshow" (F5) does nothing to the show and is kept from reloading the window', () => {
    const audio = document.createElement('button')
    audio.id = 'clear-btn-audio'
    let cleared = 0
    audio.addEventListener('click', () => cleared++)
    document.body.appendChild(audio)
    const { e } = press('F5')
    expect(cleared).toBe(0)
    expect(e.defaultPrevented).toBe(true)
    expect(index()).toBe(0)
  })

  it('Clear audio is still reachable on F7', () => {
    const audio = document.createElement('button')
    audio.id = 'clear-btn-audio'
    let cleared = 0
    audio.addEventListener('click', () => cleared++)
    document.body.appendChild(audio)
    press('F7')
    expect(cleared).toBe(1)
  })
})

describe('clicker: safety', () => {
  it('ignores the clicker while typing in a text box', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    const e = new window.KeyboardEvent('keydown', { key: 'PageDown', bubbles: true })
    Object.defineProperty(e, 'target', { value: input })
    expect(handleShowKey(e, false)).toBe(false)
    expect(index()).toBe(0)
  })

  it('ignores the clicker while a dialog is open, and while the slide editor is open', () => {
    const dialog = document.createElement('div')
    dialog.className = 'modal-overlay'
    document.body.appendChild(dialog)
    expect(press('PageDown').handled).toBe(false)
    expect(index()).toBe(0)
    dialog.remove()
    const e = new window.KeyboardEvent('keydown', { key: 'PageDown' })
    expect(handleShowKey(e, true)).toBe(false)
  })

  it('a clicker button the operator rebound follows the new binding', () => {
    state.set('shortcutOverrides', { next: ['n'], prev: ['p'] })
    press('PageDown')
    expect(index()).toBe(0)
    press('n')
    expect(index()).toBe(1)
  })
})
