import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ToastManager } from './ToastManager.js'

const live = () => [...document.querySelectorAll('.toast')].filter((t) => !t._leaving)

beforeEach(() => {
  document.body.innerHTML = ''
  ToastManager.container = null
})

describe('ToastManager', () => {
  it('shows a repeated message once instead of stacking copies', () => {
    for (let i = 0; i < 5; i++) ToastManager.show('Song imported successfully!', 'success')
    expect(live()).toHaveLength(1)
  })

  it('keeps different messages separate but never more than three at once', () => {
    for (let i = 0; i < 6; i++) ToastManager.show(`Message ${i}`, 'info')
    expect(live()).toHaveLength(3)
    expect(live().map((t) => t.textContent)).toEqual(['Message 3', 'Message 4', 'Message 5'])
  })

  it('keeps a long message up longer than a short one', async () => {
    vi.useFakeTimers()
    try {
      ToastManager.show('Saved')
      ToastManager.show('The library file was damaged, so a fresh library was started and a copy of the old one was kept.')
      vi.advanceTimersByTime(1600)
      expect(live().map((t) => t.textContent.slice(0, 5))).toEqual(['The l'])
      vi.advanceTimersByTime(6000)
      expect(live()).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('is announced politely to screen readers', () => {
    ToastManager.show('Hello')
    expect(document.querySelector('.toast-container').getAttribute('aria-live')).toBe('polite')
  })
})
