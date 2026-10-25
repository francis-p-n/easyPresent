import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { storageManager } from './StorageManager.js'
import { state } from './StateManager.js'
import { MEDIA_REF_PREFIX } from './mediaStore.js'

/**
 * A PPTX import repeats the same background data URL on every slide — a real
 * 10-slide deck measured 3.13 MB, 99% data URLs and 80% of that pure
 * duplication. The library is deduped on its way to disk and rebuilt on load;
 * the in-memory model keeps plain data URLs so nothing downstream changes.
 */

const SAVE_KEY = 'easy_present_data'
const BG = 'data:image/jpeg;base64,' + 'A'.repeat(5000)
const OTHER = 'data:image/png;base64,' + 'B'.repeat(5000)

const deckWithRepeatedBackground = () => ({
  id: 'p-heavy',
  name: 'Imported Deck',
  slides: Array.from({ length: 10 }, (_, i) => ({
    id: 's' + i,
    text: 'slide ' + i,
    background: { type: 'media', mediaPath: BG }
  }))
})

beforeEach(() => {
  localStorage.clear()
  delete window.electronAPI
  state.set('presentations', [])
  state.set('playlists', [])
  state.set('themes', [])
})

afterEach(() => {
  delete window.electronAPI
  vi.useRealTimers()
})

describe('StorageManager — media dedup on disk', () => {
  it('writes each distinct image once no matter how many slides use it', () => {
    state.set('presentations', [deckWithRepeatedBackground()])
    storageManager.save()
    const stored = JSON.parse(localStorage.getItem(SAVE_KEY))

    expect(Object.keys(stored.media)).toHaveLength(1)
    expect(Object.values(stored.media)[0]).toBe(BG)
    for (const slide of stored.presentations[0].slides) {
      expect(slide.background.mediaPath.startsWith(MEDIA_REF_PREFIX)).toBe(true)
    }
  })

  it('shrinks the serialized library substantially', () => {
    state.set('presentations', [deckWithRepeatedBackground()])
    const naive = JSON.stringify({
      version: 1,
      presentations: state.get('presentations'),
      playlists: [],
      themes: []
    }).length
    storageManager.save()
    const deduped = localStorage.getItem(SAVE_KEY).length
    expect(deduped).toBeLessThan(naive / 5)
  })

  it('restores identical data URLs on load', async () => {
    state.set('presentations', [deckWithRepeatedBackground()])
    storageManager.save()
    state.set('presentations', [])

    await storageManager.load()
    const slides = state.get('presentations')[0].slides
    expect(slides).toHaveLength(10)
    for (const s of slides) expect(s.background.mediaPath).toBe(BG)
  })

  it('shares one string instance across slides after load (no RAM duplication)', async () => {
    state.set('presentations', [deckWithRepeatedBackground()])
    storageManager.save()
    state.set('presentations', [])
    await storageManager.load()

    const slides = state.get('presentations')[0].slides
    expect(slides[0].background.mediaPath).toBe(slides[9].background.mediaPath)
  })

  it('dedupes across presentations, playlists and themes together', () => {
    state.set('presentations', [{ id: 'p1', slides: [{ id: 's', background: { mediaPath: BG } }] }])
    state.set('themes', [{ id: 't1', styles: { backgroundImage: BG } }])
    storageManager.save()
    const stored = JSON.parse(localStorage.getItem(SAVE_KEY))
    expect(Object.keys(stored.media)).toHaveLength(1)
  })

  it('keeps distinct images separate through a round trip', async () => {
    state.set('presentations', [{
      id: 'p1',
      slides: [
        { id: 's1', background: { mediaPath: BG } },
        { id: 's2', background: { mediaPath: OTHER } }
      ]
    }])
    storageManager.save()
    expect(Object.keys(JSON.parse(localStorage.getItem(SAVE_KEY)).media)).toHaveLength(2)

    state.set('presentations', [])
    await storageManager.load()
    const s = state.get('presentations')[0].slides
    expect(s[0].background.mediaPath).toBe(BG)
    expect(s[1].background.mediaPath).toBe(OTHER)
  })

  it('still loads a v1 library that has inline URLs and no media dictionary', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 1,
      presentations: [deckWithRepeatedBackground()],
      playlists: [{ id: 'pl', name: 'Set', items: [] }],
      themes: [{ id: 'default', styles: {} }]
    }))

    await storageManager.load()
    const slides = state.get('presentations')[0].slides
    expect(slides[0].background.mediaPath).toBe(BG)
    expect(state.get('playlists')[0].id).toBe('pl')
    expect(state.get('activePlaylist').id).toBe('pl')
  })

  it('upgrades a v1 library to the deduped format on the next save', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version: 1,
      presentations: [deckWithRepeatedBackground()],
      playlists: [],
      themes: []
    }))
    await storageManager.load()
    storageManager.save()

    const stored = JSON.parse(localStorage.getItem(SAVE_KEY))
    expect(stored.version).toBe(2)
    expect(Object.keys(stored.media)).toHaveLength(1)
  })
})
