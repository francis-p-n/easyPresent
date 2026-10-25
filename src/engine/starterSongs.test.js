import { describe, it, expect, beforeEach } from 'vitest'
import { installStarterSongs, toPresentation } from './starterSongs.js'
import { STARTER_SONGS, STARTER_SETLIST } from '../data/starterSongs.js'

function fakeState(init = {}) {
  const data = { presentations: [], playlists: [], ...init }
  return { get: (k) => data[k], set: (k, v) => (data[k] = v), data }
}

beforeEach(() => localStorage.clear())

describe('installStarterSongs', () => {
  it('adds all eight songs and a This Week setlist in the requested order', () => {
    const s = fakeState()
    expect(installStarterSongs(s)).toBe(true)
    expect(s.data.presentations).toHaveLength(8)

    const pl = s.data.playlists.find((p) => p.id === STARTER_SETLIST.id)
    const ids = pl.items.filter((i) => i.type === 'presentation').map((i) => i.id)
    expect(ids).toEqual(STARTER_SETLIST.songIds)
    for (const id of ids) expect(s.data.presentations.some((p) => p.id === id)).toBe(true)
  })

  it('is one-shot: deleted songs do not come back on the next launch', () => {
    const s = fakeState()
    installStarterSongs(s)
    s.data.presentations = []
    expect(installStarterSongs(s)).toBe(false)
    expect(s.data.presentations).toEqual([])
  })

  it('never overwrites a song the library already has', () => {
    const mine = { id: 'starter-hosanna', name: 'Hosanna (my edit)', slides: [] }
    const s = fakeState({ presentations: [mine] })
    installStarterSongs(s)
    expect(s.data.presentations.find((p) => p.id === 'starter-hosanna')).toBe(mine)
  })
})

describe('starter song content', () => {
  it('every chart converts to slides that carry chords and no stray sections', () => {
    for (const song of STARTER_SONGS) {
      const p = toPresentation(song)
      expect(p.slides.length, song.name).toBeGreaterThan(0)
      expect(p.slides.every((sl) => sl.text.trim()), song.name).toBe(true)
      const chordCount = p.slides.flatMap((sl) => sl.linesData || []).reduce((n, l) => n + l.chords.length, 0)
      expect(chordCount, song.name).toBeGreaterThan(0)
      // chord-only sections must not leak in as lyrics
      expect(p.slides.map((sl) => sl.text).join('\n'), song.name).not.toMatch(/^\s*(?:[A-G][#b]?(?:m|7|sus\d?)?\s*)+$/m)
    }
  })

  it('chords are kept out of slide text and stay aligned inside the line', () => {
    const p = toPresentation(STARTER_SONGS.find((s) => s.id === 'starter-kau-rajaku'))
    for (const slide of p.slides) {
      for (const l of slide.linesData) {
        expect(l.text).not.toMatch(/[[\]]/)
        for (const c of l.chords) expect(c.pos).toBeLessThanOrEqual(l.text.length)
      }
    }
  })
})
