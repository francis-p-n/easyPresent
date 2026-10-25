/**
 * songLibrary — the app-facing entry point for the chart database: start-up
 * wiring plus the export/import actions the Library menu calls.
 */
import { state } from '../core/StateManager.js'
import { createSongSync } from './songSync.js'
import { seedStarterSongs, ensureStarterSetlist } from './starterSongs.js'

let sync = null

const api = () => window.electronAPI
const hasDb = () => !!api()?.songsList

/** Seed on first run, pull charts into the library, then mirror edits. Returns true if the library changed. */
export async function initSongLibrary() {
  if (!hasDb()) return false // browser/dev mode — library.json/localStorage only
  await seedStarterSongs(api())
  sync = createSongSync({ state, api: api() })
  const pulled = await sync.pull()
  const setlist = ensureStarterSetlist(state)
  sync.start()
  return pulled > 0 || setlist
}

/** Save a portable copy of every chart (.db). Returns true when written. */
export async function exportSongDatabase() {
  if (!hasDb()) return false
  await sync?.mirror() // make sure the file reflects the latest edits
  return api().songsExport()
}

/** Merge another machine's .db in. Returns the number of charts it held, or null if cancelled. */
export async function importSongDatabase() {
  if (!hasDb()) return null
  const count = await api().songsImport()
  if (count != null) await sync?.pull()
  return count
}
