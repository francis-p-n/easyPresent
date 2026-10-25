import { describe, it, expect } from 'vitest'
import { starterRecords, seedStarterSongs, ensureStarterSetlist } from './starterSongs.js'
import { STARTER_SONGS, STARTER_SETLIST } from './starterCharts.js'
import { parseChordProToSlides } from './chordpro.js'

function fakeApi() {
  const meta = new Map()
  const rows = []
  return {
    rows,
    songsMetaGet: async (k) => meta.get(k) ?? null,
    songsMetaSet: async (k, v) => meta.set(k, v),
    songsUpsert: async (songs) => rows.push(...songs)
  }
}

describe('starter charts', () => {
  it('has all eight requested songs, each convertible to chorded slides', () => {
    const records = starterRecords()
    expect(records).toHaveLength(8)
    for (const rec of records) {
      const slides = parseChordProToSlides(rec.chordpro)
      expect(slides.length, rec.title).toBeGreaterThan(0)
      const chords = slides.flatMap((s) => s.linesData).reduce((n, l) => n + l.chords.length, 0)
      expect(chords, rec.title).toBeGreaterThan(0)
      // chord-only sections (intro/interlude) must not leak in as lyrics
      expect(slides.map((s) => s.text).join('\n'), rec.title).not.toMatch(/^\s*(?:[A-G][#b]?(?:m|7|sus\d?)?\s*)+$/m)
    }
  })

  it('setlist references only songs that exist, in the requested order', () => {
    const ids = new Set(STARTER_SONGS.map((s) => s.id))
    expect(STARTER_SETLIST.songIds).toHaveLength(8)
    STARTER_SETLIST.songIds.forEach((id) => expect(ids.has(id)).toBe(true))
  })
})

describe('seedStarterSongs', () => {
  it('seeds once; a second run (e.g. after the operator deleted songs) does nothing', async () => {
    const api = fakeApi()
    expect(await seedStarterSongs(api)).toBe(true)
    expect(api.rows).toHaveLength(8)
    expect(await seedStarterSongs(api)).toBe(false)
    expect(api.rows).toHaveLength(8)
  })
})

describe('ensureStarterSetlist', () => {
  const stateWith = (presentations, playlists = []) => {
    const data = { presentations, playlists }
    return { get: (k) => data[k], set: (k, v) => (data[k] = v), data }
  }

  it('adds the This Week setlist in order, skipping songs the library lacks', () => {
    const present = STARTER_SETLIST.songIds.filter((id) => id !== 'starter-hosanna').map((id) => ({ id }))
    const s = stateWith(present)
    expect(ensureStarterSetlist(s)).toBe(true)
    const ids = s.data.playlists[0].items.filter((i) => i.type === 'presentation').map((i) => i.id)
    expect(ids).toEqual(STARTER_SETLIST.songIds.filter((id) => id !== 'starter-hosanna'))
  })

  it('is idempotent and leaves an existing setlist alone', () => {
    const s = stateWith(STARTER_SETLIST.songIds.map((id) => ({ id })))
    ensureStarterSetlist(s)
    expect(ensureStarterSetlist(s)).toBe(false)
    expect(s.data.playlists).toHaveLength(1)
  })
})
