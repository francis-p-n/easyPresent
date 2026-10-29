import { state } from '../core/StateManager.js'
import { dehydrate, rehydrate } from './mediaStore.js'
import { cleanUserFonts } from './fontStore.js'

const SAVE_DEBOUNCE_MS = 500

/**
 * Schema version of the persisted payload.
 *   1 — inline `data:` URLs, repeated per slide
 *   2 — data URLs lifted into a shared `media` dictionary (see mediaStore.js)
 * Both are readable; v1 files are upgraded on the next save.
 */
const SCHEMA_VERSION = 2

/**
 * StorageManager — persists the library.
 *
 * Primary store: a file in Electron's userData dir (via IPC, atomic write) —
 * no 5MB localStorage quota, no silent data loss if slides ever hold images.
 * Fallback: localStorage, used in browser/dev mode or if IPC is unavailable.
 */
class StorageManager {
  constructor() {
    this.SAVE_KEY = 'easy_present_data'
    this._saveTimer = null
    this._dirty = false
  }

  _serialize() {
    // One shared dictionary across all three sections so an image used by both
    // a presentation and a theme is still stored once.
    const media = {}
    const seen = new Map()
    const lift = (v) => dehydrate(v, media, seen).value

    const presentations = lift(state.get('presentations'))
    const playlists = lift(state.get('playlists'))
    const themes = lift(state.get('themes'))
    const userTemplates = lift(state.get('userTemplates') || [])
    const userFonts = lift(state.get('userFonts') || [])

    const activePlaylistId = state.get('activePlaylist')?.id || null // so a restart reopens the same setlist
    return JSON.stringify({ version: SCHEMA_VERSION, presentations, playlists, themes, userTemplates, userFonts, media, activePlaylistId })
  }

  _applyData(data) {
    // v1 files carry no `media` key; rehydrate() then passes values through
    // untouched, so old libraries load unchanged and upgrade on the next save.
    const drop = (v) => rehydrate(v, data.media)

    if (data.presentations) state.set('presentations', drop(data.presentations))
    if (data.playlists) {
      const playlists = drop(data.playlists)
      state.set('playlists', playlists)
      // Re-point activePlaylist at the loaded object — otherwise it keeps
      // referencing the pre-load sample and saved changes never show
      const currentId = data.activePlaylistId || state.get('activePlaylist')?.id
      const match = playlists.find((p) => p.id === currentId) || playlists[0] || null
      state.set('activePlaylist', match)
    }
    if (data.themes) state.set('themes', drop(data.themes))
    if (Array.isArray(data.userTemplates)) state.set('userTemplates', drop(data.userTemplates))
    if (Array.isArray(data.userFonts)) state.set('userFonts', cleanUserFonts(drop(data.userFonts)))
  }

  /** Immediate save (async when file-backed; sync fallback to localStorage) */
  save() {
    this._dirty = false
    const json = this._serialize()

    if (window.electronAPI?.saveLibrary) {
      window.electronAPI.saveLibrary(json).catch((e) => {
        console.error('File save failed, falling back to localStorage', e)
        this._saveLocal(json)
      })
    } else {
      this._saveLocal(json)
    }
  }

  _saveLocal(json) {
    try {
      localStorage.setItem(this.SAVE_KEY, json)
    } catch (e) {
      console.error('Failed to save data', e)
      // Surface it — losing edits silently during a live service is the worst case
      import('../components/common/ToastManager.js').then(({ showToast }) => {
        showToast('Saving failed — storage may be full!', 'error')
      })
    }
  }

  /** Debounced save — coalesces rapid state changes */
  scheduleSave() {
    this._dirty = true
    clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => this.save(), SAVE_DEBOUNCE_MS)
  }

  /** Load persisted data. Await this before mounting the UI. */
  async load() {
    // Preferred: library file via IPC
    if (window.electronAPI?.loadLibrary) {
      try {
        const json = await window.electronAPI.loadLibrary()
        if (json) {
          this._applyData(JSON.parse(json))
          return
        }
        // No file yet — migrate from localStorage if present
        const legacy = localStorage.getItem(this.SAVE_KEY)
        if (legacy) {
          this._applyData(JSON.parse(legacy))
          window.electronAPI.saveLibrary(legacy).catch(() => {})
          return
        }
        return
      } catch (e) {
        console.error('File load failed, trying localStorage', e)
      }
    }

    // Fallback: localStorage
    try {
      const str = localStorage.getItem(this.SAVE_KEY)
      if (str) {
        this._applyData(JSON.parse(str))
      }
    } catch (e) {
      console.error('Failed to load data', e)
    }
  }

  /**
   * If the library file was damaged at load, say so: it was either restored from
   * the newest readable backup or (no backup) replaced by the sample library, and
   * a copy of the damaged file was kept. Call once after load().
   */
  async reportRecovery() {
    const recovery = await window.electronAPI?.libraryRecovery?.()
    if (!recovery) return
    const { showToast } = await import('../components/common/ToastManager.js')
    showToast(
      recovery.kind === 'backup'
        ? `Your library file was damaged and has been restored from the backup made at ${
            recovery.backupAt ? new Date(recovery.backupAt).toLocaleString() : 'an earlier time'
          }. Anything changed after that is not in it. A copy of the damaged file was kept.`
        : 'Your library file was damaged and no backup was available, so EasyPresent started with a fresh library. A copy of the damaged file was kept.',
      'error'
    )
  }

  /** Exports the library to a user-chosen .json file. Returns true on write. */
  async exportLibrary() {
    if (!window.electronAPI?.exportLibrary) return false
    return window.electronAPI.exportLibrary(this._serialize())
  }

  /**
   * Imports a library .json chosen by the user, replacing the current one
   * (main process snapshots the old library to backups/ first). Returns true
   * when a file was imported, false when the dialog was cancelled.
   */
  async importLibrary() {
    if (!window.electronAPI?.importLibrary) return false
    const json = await window.electronAPI.importLibrary()
    if (!json) return false
    this._applyData(JSON.parse(json))
    return true
  }

  initAutoSave() {
    state.on('presentations', () => this.scheduleSave())
    state.on('playlists', () => this.scheduleSave())
    state.on('themes', () => this.scheduleSave())
    state.on('userTemplates', () => this.scheduleSave())
    state.on('userFonts', () => this.scheduleSave())
    state.on('activePlaylist', () => this.scheduleSave()) // switching setlists alone must survive a restart

    // Don't lose a pending debounced save when the window closes
    window.addEventListener('beforeunload', () => {
      if (this._dirty) this.save()
    })
  }
}

export const storageManager = new StorageManager()
