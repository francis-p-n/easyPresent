import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { icon, icons } from './Icons.js'
import { ToastManager, showToast } from './ToastManager.js'
import { VirtualScroller } from './VirtualScroller.js'

describe('Icons', () => {
  it('returns a sized span wrapping the SVG for known names', () => {
    const el = icon('play', 20)
    expect(el.tagName).toBe('SPAN')
    expect(el.querySelector('svg')).toBeTruthy()
    expect(el.style.width).toBe('20px')
  })

  it('defaults to 16px', () => {
    expect(icon('x').style.width).toBe('16px')
  })

  it('returns an empty span (not a crash) for unknown names', () => {
    const el = icon('definitely-not-an-icon')
    expect(el.querySelector('svg')).toBeNull()
  })

  it('every registered icon is valid SVG markup', () => {
    for (const name of Object.keys(icons)) {
      expect(icon(name).querySelector('svg'), `icon "${name}"`).toBeTruthy()
    }
  })
})

describe('ToastManager', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    ToastManager.container?.remove()
    ToastManager.container = null
  })

  it('shows a toast with the requested type', () => {
    showToast('Saved!', 'success')
    const toast = document.querySelector('.toast')
    expect(toast.textContent).toBe('Saved!')
    expect(toast.classList.contains('toast--success')).toBe(true)
  })

  it('begins dismissing after 3 seconds', () => {
    showToast('Bye', 'info')
    const toast = document.querySelector('.toast')
    expect(toast.classList.contains('toast--visible')).toBe(true)
    vi.advanceTimersByTime(3000)
    expect(toast.classList.contains('toast--visible')).toBe(false)
  })

  it('stacks multiple toasts in one container', () => {
    showToast('one')
    showToast('two')
    expect(document.querySelectorAll('.toast-container')).toHaveLength(1)
    expect(document.querySelectorAll('.toast')).toHaveLength(2)
  })
})

describe('VirtualScroller', () => {
  let container, scroller

  beforeEach(() => {
    container = document.createElement('div')
    // jsdom has no layout — give the container a fixed viewport height
    Object.defineProperty(container, 'clientHeight', { value: 200, configurable: true })
    document.body.appendChild(container)

    scroller = new VirtualScroller(container, {
      getItemHeight: () => 40,
      renderItem: (item) => {
        const el = document.createElement('div')
        el.className = 'row'
        el.textContent = item.label
        return el
      }
    })
  })

  afterEach(() => container.remove())

  const makeItems = (n) => Array.from({ length: n }, (_, i) => ({ label: `item ${i}` }))

  it('sizes the scroll area to the full item list', () => {
    scroller.setItems(makeItems(100))
    expect(scroller.scroller.style.height).toBe('4000px')
  })

  it('renders only the visible window plus buffer, not all items', () => {
    scroller.setItems(makeItems(100))
    const rendered = container.querySelectorAll('.row').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(30) // ~5 visible + buffers, never all 100
  })

  it('positions rows absolutely at their computed offsets', () => {
    scroller.setItems(makeItems(10))
    const rows = [...container.querySelectorAll('.row')]
    expect(rows[0].style.top).toBe('0px')
    expect(rows[1].style.top).toBe('40px')
  })

  it('windows forward on scroll', () => {
    scroller.setItems(makeItems(100))
    container.scrollTop = 2000 // row 50
    scroller._render()
    const labels = [...container.querySelectorAll('.row')].map((r) => r.textContent)
    expect(labels).toContain('item 50')
    expect(labels).not.toContain('item 0')
  })

  it('clears everything when items are emptied', () => {
    scroller.setItems(makeItems(10))
    scroller.setItems([])
    expect(container.querySelectorAll('.row')).toHaveLength(0)
  })
})
