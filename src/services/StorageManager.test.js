import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { storageManager } from './StorageManager.js'
import { state } from '../core/StateManager.js'

const SAVE_KEY = 'easy_present_data'

const samplePayload = () => ({
  presentations: [{ id: 'x1', name: 'Loaded Pres', category: 'Test', slides: [] }],
  playlists: [{ id: 'plx', name: 'Loaded Playlist', items: [] }],
  themes: [{ id: 'default', name: 'T', styles: {} }]
})

beforeEach(() => {
  localStorage.clear()
  delete window.electronAPI
})

afterEach(() => {
  delete window.electronAPI
  vi.useRealTimers()
})

describe('StorageManager — localStorage fallback (no Electron)', () => {
  it('save() writes the library to localStorage', () => {
    state.set('presentations', samplePayload().presentations)
    storageManager.save()
    const stored = JSON.parse(localStorage.getItem(SAVE_KEY))
    expect(stored.presentations[0].name).toBe('Loaded Pres')
    expect(stored).toHaveProperty('playlists')
    expect(stored).toHaveProperty('themes')
  })

  it('load() restores presentations, playlists, and themes', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(samplePayload()))
    await storageManager.load()
    expect(state.get('presentations')[0].id).toBe('x1')
    expect(state.get('playlists')[0].id).toBe('plx')
    // activePlaylist re-pointed at a loaded object, not the stale sample
    expect(state.get('activePlaylist').id).toBe('plx')
  })

  it('load() survives corrupt JSON without throwing', async () => {
    localStorage.setItem(SAVE_KEY, '{not json')
    const before = state.get('presentations')
    await expect(storageManager.load()).resolves.toBeUndefined()
    expect(state.get('presentations')).toBe(before) // untouched
  })
})

describe('StorageManager — Electron file backend', () => {
  it('load() prefers the IPC file over localStorage', async () => {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...samplePayload(), presentations: [{ id: 'stale', name: 'stale', slides: [] }] })
    )
    window.electronAPI = {
      loadLibrary: vi.fn().mockResolvedValue(JSON.stringify(samplePayload())),
      saveLibrary: vi.fn().mockResolvedValue(true)
    }
    await storageManager.load()
    expect(state.get('presentations')[0].id).toBe('x1')
    expect(window.electronAPI.loadLibrary).toHaveBeenCalled()
  })

  it('load() migrates legacy localStorage data when no file exists yet', async () => {
    const legacy = JSON.stringify(samplePayload())
    localStorage.setItem(SAVE_KEY, legacy)
    window.electronAPI = {
      loadLibrary: vi.fn().mockResolvedValue(null),
      saveLibrary: vi.fn().mockResolvedValue(true)
    }
    await storageManager.load()
    expect(state.get('presentations')[0].id).toBe('x1')
    expect(window.electronAPI.saveLibrary).toHaveBeenCalledWith(legacy)
  })

  it('save() routes through the IPC bridge when available', () => {
    window.electronAPI = { saveLibrary: vi.fn().mockResolvedValue(true) }
    storageManager.save()
    expect(window.electronAPI.saveLibrary).toHaveBeenCalledTimes(1)
    const json = window.electronAPI.saveLibrary.mock.calls[0][0]
    expect(() => JSON.parse(json)).not.toThrow()
  })
})

describe('StorageManager — debounced saves', () => {
  it('coalesces rapid scheduleSave() calls into one save', () => {
    vi.useFakeTimers()
    const saveSpy = vi.spyOn(storageManager, 'save').mockImplementation(() => {})

    storageManager.scheduleSave()
    storageManager.scheduleSave()
    storageManager.scheduleSave()
    expect(saveSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(499)
    expect(saveSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(saveSpy).toHaveBeenCalledTimes(1)
    saveSpy.mockRestore()
  })
})

describe('StorageManager — saved slide templates', () => {
  it('persists user templates and restores them on load', async () => {
    const tpl = { id: 'ut-1', label: 'Mine', bg: '#101010', boxes: [{ x: 1, y: 2, width: 3, height: 4, text: 'T' }] }
    state.set('userTemplates', [tpl])
    storageManager.save()
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)).userTemplates).toEqual([tpl])

    state.set('userTemplates', [])
    await storageManager.load()
    expect(state.get('userTemplates')).toEqual([tpl])
  })

  it('loads old libraries that have no templates key without touching the current list', async () => {
    state.set('userTemplates', [])
    localStorage.setItem(SAVE_KEY, JSON.stringify(samplePayload()))
    await storageManager.load()
    expect(state.get('userTemplates')).toEqual([])
  })
})
