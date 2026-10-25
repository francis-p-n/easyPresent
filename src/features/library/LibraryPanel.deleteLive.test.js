import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state } from '../../engine/StateManager.js'

/**
 * Regression: deleting the presentation that is currently LIVE used to clear
 * `selectedPresentation` but leave `layers.slide` pointing at a slide from the
 * now-deleted deck. The projector kept showing that slide, and because the deck
 * was gone from the library the operator couldn't reselect it to clear — the
 * audience just stared at an orphaned slide.
 */

class FakeSearchWorker {
  postMessage({ items }) {
    Promise.resolve().then(() => this.onmessage?.({ data: { ids: items.map((i) => i.id) } }))
  }
  terminate() {}
}

const LIVE_DECK = {
  id: 'p-live',
  name: 'Live Deck',
  slides: [
    { id: 'ls1', text: 'first' },
    { id: 'ls2', text: 'second' }
  ]
}
const OTHER_DECK = { id: 'p-other', name: 'Other Deck', slides: [{ id: 'os1', text: 'other' }] }

let container, panel

beforeEach(async () => {
  vi.stubGlobal('Worker', FakeSearchWorker)
  container = document.createElement('div')
  document.body.appendChild(container)

  state.set('presentations', JSON.parse(JSON.stringify([LIVE_DECK, OTHER_DECK])))
  state.set('selectedPresentation', state.get('presentations')[0])
  state.set('activeSlideIndex', 1)
  state.set('liveSlideIndex', 1)
  state.set('layers', {
    ...state.get('layers'),
    slide: { active: true, content: { id: 'ls2', text: 'second' } }
  })

  const { LibraryPanel } = await import('./LibraryPanel.js')
  panel = new LibraryPanel(container)
})

afterEach(() => {
  document.querySelector('.context-menu')?.remove()
  document.getElementById('confirm-dialog-overlay')?.remove()
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const deleteViaMenu = (presId) => {
  panel._showContextMenu(0, 0, presId)
  document.querySelector('.context-menu [data-action="delete"]').click()
  document.getElementById('confirm-ok').click()
}

describe('LibraryPanel — deleting the live presentation', () => {
  it('takes the live slide off the projector', () => {
    deleteViaMenu('p-live')
    expect(state.get('layers').slide.active).toBe(false)
    expect(state.get('layers').slide.content).toBeNull()
    expect(state.get('liveSlideIndex')).toBe(-1)
  })

  it('removes the deck from the library', () => {
    deleteViaMenu('p-live')
    expect(state.get('presentations').map((p) => p.id)).toEqual(['p-other'])
  })

  it('leaves the projector alone when deleting a deck that is NOT live', () => {
    deleteViaMenu('p-other')
    expect(state.get('layers').slide.active).toBe(true)
    expect(state.get('layers').slide.content.id).toBe('ls2')
    expect(state.get('liveSlideIndex')).toBe(1)
  })
})
