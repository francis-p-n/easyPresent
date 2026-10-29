import { STARTER_SONGS, STARTER_SETLIST } from './starterCharts.js'
import { chordsOverLyricsToChordPro } from './chordSheetParse.js'

const SEED_FLAG = 'starter_songs_v1'

/** The bundled charts as database records (ChordPro). */
export function starterRecords(now = Date.now(), songs = STARTER_SONGS) {
  return songs.map((s) => ({
    id: s.id,
    title: s.name,
    category: s.category,
    key: s.key || null,
    chordpro: chordsOverLyricsToChordPro(s.sheet),
    updatedAt: now
  }))
}

/** Record that the starter set is spoken for, without adding it (used after a database rebuild). */
export async function markStarterSeeded(api) {
  await api.songsMetaSet(SEED_FLAG, '1')
}

/**
 * First-run seeding: put the bundled charts in the database once. A flag in
 * the database (not the library) records it, so a song the operator deletes
 * never comes back, and a database carried to a new machine isn't re-seeded.
 */
export async function seedStarterSongs(api, songs = STARTER_SONGS) {
  if (await api.songsMetaGet(SEED_FLAG)) return false
  await api.songsUpsert(starterRecords(Date.now(), songs))
  await api.songsMetaSet(SEED_FLAG, '1')
  return true
}

/** Adds the "This Week" setlist (once, by id) when its songs exist in the library. */
export function ensureStarterSetlist(state, starter = STARTER_SETLIST) {
  const playlists = state.get('playlists') || []
  if (playlists.some((p) => p.id === starter.id)) return false
  const have = new Set((state.get('presentations') || []).map((p) => p.id))
  const ids = starter.songIds.filter((id) => have.has(id))
  if (!ids.length) return false
  const setlist = {
    id: starter.id,
    name: starter.name,
    items: [{ type: 'header', text: 'Worship' }, ...ids.map((id) => ({ type: 'presentation', id }))]
  }
  state.set('playlists', [...playlists, setlist])
  state.set('activePlaylist', setlist) // this week's setlist is what the operator wants first
  return true
}
