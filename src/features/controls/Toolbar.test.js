import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state } from '../../engine/StateManager.js'
import { Toolbar } from './Toolbar.js'

/**
 * Toolbar coverage: view switching, layer clearing, and the Library
 * export/import menu (backed by StorageManager → window.electronAPI).
 */

let container, _toolbar

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  state.set('activeView', 'library')
  state.set('searchQuery', '')
  _toolbar = new Toolbar(container)
})

afterEach(() => {
  container.remove()
  delete window.electronAPI
  vi.restoreAllMocks()
})

describe('Toolbar — view tabs', () => {
  it('renders the view tabs and marks the active one', () => {
    const active = container.querySelector('.toolbar-view-btn.active')
    expect(active).not.toBeNull()
    expect(active.dataset.view).toBe('library')
  })

  it('clicking a tab switches activeView state and the active class', () => {
    const tabs = [...container.querySelectorAll('.toolbar-view-btn')]
    const other = tabs.find((t) => t.dataset.view !== 'library')
    other.click()
    expect(state.get('activeView')).toBe(other.dataset.view)
    expect(other.classList.contains('active')).toBe(true)
  })
})

describe('Toolbar — clear buttons', () => {
  it('Clear All deactivates every layer and resets liveSlideIndex', () => {
    const layers = { ...state.get('layers') }
    layers.slide = { active: true, content: { text: 'live' } }
    state.set('layers', layers)
    state.set('liveSlideIndex', 3)

    container.querySelector('#clear-btn-all').click()

    expect(state.get('layers').slide.active).toBe(false)
    expect(state.get('liveSlideIndex')).toBe(-1)
  })

  it('clearing a single layer leaves the others alone', () => {
    const layers = { ...state.get('layers') }
    layers.slide = { active: true, content: { text: 'live' } }
    layers.message = { active: true, content: 'hello' }
    state.set('layers', layers)

    container.querySelector('#clear-btn-slide').click()

    expect(state.get('layers').slide.active).toBe(false)
    expect(state.get('layers').message.active).toBe(true)
  })
})

describe('Toolbar — search', () => {
  it('typing in the search box updates searchQuery state', () => {
    const input = container.querySelector('#toolbar-search-input')
    input.value = 'amazing grace'
    input.dispatchEvent(new window.Event('input'))
    expect(state.get('searchQuery')).toBe('amazing grace')
  })
})

describe('Toolbar — Library backup menu', () => {
  const menu = () => container.querySelector('#toolbar-library-menu')

  it('is closed by default and opens on button click', () => {
    expect(menu().style.display).toBe('none')
    container.querySelector('#toolbar-library-btn').click()
    expect(menu().style.display).toBe('block')
  })

  it('closes when clicking elsewhere in the document', () => {
    container.querySelector('#toolbar-library-btn').click()
    document.body.click()
    expect(menu().style.display).toBe('none')
  })

  it('Export sends the serialized library (with schema version) to the main process', async () => {
    const exportLibrary = vi.fn().mockResolvedValue(true)
    window.electronAPI = { exportLibrary }
    state.set('presentations', [{ id: 'p1', name: 'Test' }])

    container.querySelector('#library-export-btn').click()
    await vi.waitFor(() => expect(exportLibrary).toHaveBeenCalled())

    const payload = JSON.parse(exportLibrary.mock.calls[0][0])
    expect(payload.version).toBe(2)
    expect(payload.presentations[0].id).toBe('p1')
  })

  it('Import applies the returned library to app state', async () => {
    const imported = JSON.stringify({
      version: 1,
      presentations: [{ id: 'imported-1', name: 'From file' }],
      playlists: [],
      themes: []
    })
    window.electronAPI = { importLibrary: vi.fn().mockResolvedValue(imported) }

    container.querySelector('#library-import-btn').click()
    await vi.waitFor(() =>
      expect(state.get('presentations')[0]?.id).toBe('imported-1')
    )
  })

  it('a cancelled import leaves current state untouched', async () => {
    state.set('presentations', [{ id: 'keep' }])
    window.electronAPI = { importLibrary: vi.fn().mockResolvedValue(null) }

    container.querySelector('#library-import-btn').click()
    await vi.waitFor(() => expect(window.electronAPI.importLibrary).toHaveBeenCalled())

    expect(state.get('presentations')[0].id).toBe('keep')
  })
})
