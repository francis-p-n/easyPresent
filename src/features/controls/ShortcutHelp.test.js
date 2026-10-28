import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { state } from '../../core/StateManager.js'
import { showShortcutHelp } from './ShortcutHelp.js'
import { SHORTCUTS_KEY } from '../../core/shortcuts.js'

const overlay = () => document.getElementById('shortcut-help-overlay')
const row = (id) => overlay().querySelector(`[data-action="${id}"]`)
const press = (init) => document.dispatchEvent(new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))

beforeEach(() => {
  localStorage.clear()
  state.set('shortcutOverrides', {})
})
afterEach(() => {
  overlay()?.querySelector('.shortcut-close')?.click()
  document.body.innerHTML = ''
})

describe('ShortcutHelp', () => {
  it('lists every action with its current keys', () => {
    showShortcutHelp()
    expect(row('next').querySelector('.shortcut-keys').textContent).toContain('Space')
    expect(row('clearAll').querySelector('.shortcut-keys').textContent).toContain('Esc')
    expect(row('hideAudienceText').querySelector('.shortcut-keys').textContent).toBe('(no key)')
  })

  it('Set key waits for a key and makes it the only one', () => {
    showShortcutHelp()
    row('logo').querySelector('.shortcut-set').click()
    expect(overlay().querySelector('#shortcut-hint').textContent).toContain('Press the key')
    press({ key: 'l' })
    expect(state.get('shortcutOverrides')).toEqual({ logo: ['l'] })
    expect(row('logo').querySelector('.shortcut-keys').textContent).toBe('L')
    expect(JSON.parse(localStorage.getItem(SHORTCUTS_KEY))).toEqual({ logo: ['l'] })
  })

  it('+ adds a key and keeps the existing ones', () => {
    showShortcutHelp()
    row('logo').querySelector('.shortcut-add').click()
    press({ key: 'l' })
    expect(row('logo').querySelector('.shortcut-keys').textContent).toContain('F6')
    expect(row('logo').querySelector('.shortcut-keys').textContent).toContain('L')
  })

  it('says when a key is taken from another action', () => {
    showShortcutHelp()
    row('logo').querySelector('.shortcut-set').click()
    press({ key: 'b' })
    expect(overlay().querySelector('#shortcut-hint').textContent).toContain('no longer does “Clear everything”')
    expect(row('clearAll').querySelector('.shortcut-keys').textContent).not.toContain('B')
  })

  it('ignores a bare modifier and a chord while waiting, and Esc cancels', () => {
    showShortcutHelp()
    row('logo').querySelector('.shortcut-set').click()
    press({ key: 'Shift', shiftKey: true })
    press({ key: 'x', ctrlKey: true })
    expect(state.get('shortcutOverrides')).toEqual({})
    press({ key: 'Escape' })
    expect(state.get('shortcutOverrides')).toEqual({})
    expect(overlay()).not.toBeNull() // Esc cancelled the wait, it did not close the sheet
    press({ key: 'Escape' })
    expect(overlay()).toBeNull() // a second Esc closes it
  })

  it('the key pressed while waiting never reaches the show', () => {
    let reached = false
    document.addEventListener('keydown', () => (reached = true))
    showShortcutHelp()
    row('logo').querySelector('.shortcut-set').click()
    press({ key: 'l' })
    expect(reached).toBe(false)
  })

  it('Default and Reset all put the original keys back', () => {
    showShortcutHelp()
    row('logo').querySelector('.shortcut-set').click()
    press({ key: 'l' })
    row('logo').querySelector('.shortcut-reset').click()
    expect(state.get('shortcutOverrides')).toEqual({})

    row('next').querySelector('.shortcut-set').click()
    press({ key: 'n' })
    row('prev').querySelector('.shortcut-set').click()
    press({ key: 'p' })
    overlay().querySelector('.shortcut-reset-all').click()
    expect(state.get('shortcutOverrides')).toEqual({})
    expect(JSON.parse(localStorage.getItem(SHORTCUTS_KEY))).toEqual({})
  })

  it('closing removes the listener, so keys are not captured afterwards', () => {
    showShortcutHelp()
    overlay().querySelector('.shortcut-close').click()
    const e = new window.KeyboardEvent('keydown', { key: 'l', bubbles: true, cancelable: true })
    document.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(false)
  })

  it('opening it twice leaves one sheet', () => {
    showShortcutHelp()
    showShortcutHelp()
    expect(document.querySelectorAll('#shortcut-help-overlay')).toHaveLength(1)
  })
})
