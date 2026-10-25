import { STARTER_SONGS, STARTER_SETLIST } from '../data/starterSongs.js'
import { parseChordProToSlides } from '../features/library/SongImporter.js'
import { chordsOverLyricsToChordPro } from './chordSheetParse.js'

const FLAG = 'easypresent_starter_songs_v1'
const PLACEHOLDER = '(Lyrics not added yet — use Import Song to paste them)'

const flagSet = () => {
  try {
    return !!localStorage.getItem(FLAG)
  } catch {
    return false
  }
}
const setFlag = () => {
  try {
    localStorage.setItem(FLAG, '1')
  } catch {
    /* private mode — worst case the (idempotent) install re-runs */
  }
}

export function toPresentation(song) {
  const slides = song.sheet
    ? parseChordProToSlides(chordsOverLyricsToChordPro(song.sheet), 4)
    : [{ id: `${song.id}-s1`, group: 'verse', label: 'Verse 1', text: PLACEHOLDER }]
  return { id: song.id, name: song.name, category: song.category, key: song.key, slides }
}

/**
 * One-time install of the starter songs + "This Week" setlist into the loaded
 * library. Never overwrites: songs/playlists already present by id are left
 * alone, and a flag stops songs the operator deletes from coming back.
 * Returns true when something was added (caller should save).
 */
export function installStarterSongs(state) {
  if (flagSet()) return false

  const presentations = [...(state.get('presentations') || [])]
  const have = new Set(presentations.map((p) => p.id))
  let changed = false

  for (const song of STARTER_SONGS) {
    if (have.has(song.id)) continue
    presentations.push(toPresentation(song))
    changed = true
  }

  const playlists = [...(state.get('playlists') || [])]
  if (!playlists.some((p) => p.id === STARTER_SETLIST.id)) {
    playlists.push({
      id: STARTER_SETLIST.id,
      name: STARTER_SETLIST.name,
      items: [{ type: 'header', text: 'Worship' }, ...STARTER_SETLIST.songIds.map((id) => ({ type: 'presentation', id }))]
    })
    changed = true
  }

  if (changed) {
    state.set('presentations', presentations)
    state.set('playlists', playlists)
  }
  setFlag()
  return changed
}
