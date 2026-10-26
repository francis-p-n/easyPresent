/**
 * songSync — keeps song presentations in the library and the local SQLite
 * chart database in step.
 *
 * The database (electron/services/songDb.js) is the portable copy of every
 * chart, stored as ChordPro. This module:
 *   - pulls charts the library doesn't have (first run, or after importing
 *     another machine's .db) into the library as presentations, and
 *   - mirrors library edits, additions and deletions back to the database.
 *
 * `api` is the slice of window.electronAPI it needs, so tests can fake it.
 */
import { parseChordProToSlides, slidesToChordPro } from './chordpro.js'

const SONG_CATEGORIES = new Set(['worship', 'hymns', 'songs'])
const MIRROR_DELAY_MS = 800

export const isSong = (p) => !!p && SONG_CATEGORIES.has(String(p.category || '').toLowerCase())

export function toRecord(p, updatedAt = Date.now()) {
  return { id: p.id, title: p.name, category: p.category, key: p.key || null, chordpro: slidesToChordPro(p.slides), updatedAt }
}

export function fromRecord(rec, maxLines = 4) {
  return {
    id: rec.id,
    name: rec.title,
    category: rec.category,
    key: rec.key || undefined,
    slides: parseChordProToSlides(rec.chordpro, maxLines)
  }
}

// What identifies a chart's content (excludes the timestamp)
const signature = (r) => JSON.stringify([r.title, r.category, r.key, r.chordpro])

export function createSongSync({ state, api }) {
  const known = new Map() // id -> { sig, updatedAt } as last seen in the database
  let timer = null

  async function pull() {
    const rows = await api.songsList()
    const presentations = [...(state.get('presentations') || [])]
    const index = new Map(presentations.map((p, i) => [p.id, i]))
    let changed = 0

    for (const rec of rows) {
      const prev = known.get(rec.id)
      known.set(rec.id, { sig: signature(rec), updatedAt: rec.updatedAt })
      if (!index.has(rec.id)) {
        presentations.push(fromRecord(rec))
        changed++
      } else if (prev && rec.updatedAt > prev.updatedAt && prev.sig !== signature(rec)) {
        const existing = presentations[index.get(rec.id)]
        presentations[index.get(rec.id)] = { ...fromRecord(rec), ...(existing.transpose ? { transpose: existing.transpose } : {}) } // newer copy arrived via import; keep the chosen key
        changed++
      }
    }
    if (changed) state.set('presentations', presentations)
    return changed
  }

  async function mirror() {
    const songs = (state.get('presentations') || []).filter(isSong)
    const upserts = []
    for (const p of songs) {
      const rec = toRecord(p)
      const prev = known.get(p.id)
      if (!prev || prev.sig !== signature(rec)) {
        upserts.push(rec)
        known.set(p.id, { sig: signature(rec), updatedAt: rec.updatedAt })
      }
    }
    const present = new Set(songs.map((p) => p.id))
    const removed = [...known.keys()].filter((id) => !present.has(id))
    removed.forEach((id) => known.delete(id))

    if (upserts.length) await api.songsUpsert(upserts)
    if (removed.length) await api.songsRemove(removed)
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => mirror().catch((e) => console.error('Song mirror failed:', e)), MIRROR_DELAY_MS)
  }

  return {
    pull,
    mirror,
    /** Begin mirroring library edits to the database. Call after the first pull. */
    start() {
      state.on('presentations', schedule)
    }
  }
}
