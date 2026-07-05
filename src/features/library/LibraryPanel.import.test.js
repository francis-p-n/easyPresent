import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state } from '../../engine/StateManager.js'

/**
 * Integration: the "Import PPTX" flow from button click through to the
 * presentation stored in state. The parser result is mocked at the IPC
 * boundary (window.electronAPI.importPptx) — the parser itself is covered by
 * electron/pptx-parser.test.js. The search worker is faked since jsdom has
 * no Worker; the fake applies the real filter contract.
 */

class FakeSearchWorker {
  postMessage({ query, items }) {
    const q = (query || '').toLowerCase()
    const ids = items.filter((i) => !q || i.searchText.includes(q)).map((i) => i.id)
    queueMicrotask(() => this.onmessage?.({ data: { ids } }))
  }
  terminate() {}
}

const flush = () => new Promise((r) => setTimeout(r, 0))

let container, LibraryPanel

beforeEach(async () => {
  vi.stubGlobal('Worker', FakeSearchWorker)
  ;({ LibraryPanel } = await import('./LibraryPanel.js'))
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  container.remove()
  delete window.electronAPI
  vi.unstubAllGlobals()
})

const PARSED = {
  name: 'Sunday Deck',
  slides: [
    {
      slideName: 'slide1.xml',
      text: 'How great the pain of sear-ing loss.',
      bgImage: 'data:image/png;base64,AAAA',
      style: { fontSize: 84, bold: true, color: '#FFFFFF' }
    },
    { slideName: 'slide2.xml', text: 'Plain slide', bgImage: null, style: {} }
  ]
}

describe('LibraryPanel — PPTX import integration', () => {
  it('imports slides with text, style, and background mapped into state', async () => {
    window.electronAPI = { importPptx: vi.fn().mockResolvedValue(PARSED) }
    const before = state.get('presentations').length

    new LibraryPanel(container)
    container.querySelector('#library-import-pptx-btn').click()
    await flush()

    const presentations = state.get('presentations')
    expect(presentations).toHaveLength(before + 1)

    const imported = presentations[presentations.length - 1]
    expect(imported.name).toBe('Sunday Deck')
    expect(imported.slides).toHaveLength(2)

    const [s1, s2] = imported.slides
    expect(s1.text).toBe('How great the pain of sear-ing loss.')
    expect(s1.style).toEqual({ fontSize: 84, bold: true, color: '#FFFFFF' })
    expect(s1.background).toEqual({ type: 'media', color: '#000000', mediaPath: 'data:image/png;base64,AAAA' })

    // Empty style objects are dropped, color background default applied
    expect(s2.style).toBeUndefined()
    expect(s2.background).toEqual({ type: 'color', color: '#000000', mediaPath: null })

    // The imported deck becomes the selected presentation
    expect(state.get('selectedPresentation').id).toBe(imported.id)
    expect(state.get('activeSlideIndex')).toBe(0)
  })

  it('does nothing when the user cancels the file dialog', async () => {
    window.electronAPI = { importPptx: vi.fn().mockResolvedValue(null) }
    const before = state.get('presentations').length

    new LibraryPanel(container)
    container.querySelector('#library-import-pptx-btn').click()
    await flush()

    expect(state.get('presentations')).toHaveLength(before)
  })

  it('supports the legacy bare-array parser shape', async () => {
    window.electronAPI = {
      importPptx: vi.fn().mockResolvedValue([{ text: 'legacy slide', bgImage: null }])
    }

    new LibraryPanel(container)
    container.querySelector('#library-import-pptx-btn').click()
    await flush()

    const presentations = state.get('presentations')
    const imported = presentations[presentations.length - 1]
    expect(imported.name).toBe('Imported Presentation')
    expect(imported.slides[0].text).toBe('legacy slide')
  })
})
