import { describe, it, expect } from 'vitest'
import { starterRecords, seedStarterSongs, ensureStarterSetlist } from './starterSongs.js'
import { STARTER_SONGS, STARTER_SETLIST } from './starterCharts.js'
import { parseChordProToSlides } from './chordpro.js'

// Public-domain hymns written for these tests: the app itself bundles no songs
const FIXTURE_SONGS = [
  {
    id: 'fixture-grace',
    name: 'Amazing Grace',
    category: 'Hymns',
    key: 'G',
    sheet: `[Intro]
G C G

[Verse 1]
G        G7      C        G
Amazing grace how sweet the sound
G              Em     D
That saved a wretch like me`
  },
  {
    id: 'fixture-joy',
    name: 'Joy to the World',
    category: 'Hymns',
    key: 'D',
    sheet: `[Verse 1]
D       A7     D
Joy to the world, the Lord is come
D       A7     D
Let earth receive her King`
  },
  {
    id: 'fixture-holy',
    name: 'Holy Holy Holy',
    category: 'Hymns',
    key: 'E',
    sheet: `[Verse 1]
E          A     E
Holy holy holy Lord God Almighty
E           B7    E
Early in the morning our song shall rise to thee`
  }
]
const FIXTURE_SETLIST = { id: 'fixture-list', name: 'This Week', songIds: FIXTURE_SONGS.map((s) => s.id) }

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

describe('what the app bundles', () => {
  it('no songs: the operator adds their own', () => {
    expect(STARTER_SONGS).toEqual([])
    expect(starterRecords()).toEqual([])
    expect(STARTER_SETLIST.songIds).toEqual([])
  })
})

describe('starter charts', () => {
  it('turns each chart into chorded slides, with chord-only sections kept out of the lyrics', () => {
    const records = starterRecords(Date.now(), FIXTURE_SONGS)
    expect(records).toHaveLength(3)
    for (const rec of records) {
      const slides = parseChordProToSlides(rec.chordpro)
      expect(slides.length, rec.title).toBeGreaterThan(0)
      const chords = slides.flatMap((s) => s.linesData).reduce((n, l) => n + l.chords.length, 0)
      expect(chords, rec.title).toBeGreaterThan(0)
      expect(slides.map((s) => s.text).join('\n'), rec.title).not.toMatch(/^\s*(?:[A-G][#b]?(?:m|7|sus\d?)?\s*)+$/m)
    }
  })
})

describe('seedStarterSongs', () => {
  it('seeds once; a second run (e.g. after the operator deleted songs) does nothing', async () => {
    const api = fakeApi()
    expect(await seedStarterSongs(api, FIXTURE_SONGS)).toBe(true)
    expect(api.rows).toHaveLength(3)
    expect(await seedStarterSongs(api, FIXTURE_SONGS)).toBe(false)
    expect(api.rows).toHaveLength(3)
  })

  it('with nothing bundled it adds nothing', async () => {
    const api = fakeApi()
    await seedStarterSongs(api)
    expect(api.rows).toHaveLength(0)
  })
})

describe('ensureStarterSetlist', () => {
  const stateWith = (presentations, playlists = []) => {
    const data = { presentations, playlists }
    return { get: (k) => data[k], set: (k, v) => (data[k] = v), data }
  }

  it('adds the setlist in order, skipping songs the library lacks', () => {
    const present = FIXTURE_SETLIST.songIds.filter((id) => id !== 'fixture-joy').map((id) => ({ id }))
    const s = stateWith(present)
    expect(ensureStarterSetlist(s, FIXTURE_SETLIST)).toBe(true)
    const ids = s.data.playlists[0].items.filter((i) => i.type === 'presentation').map((i) => i.id)
    expect(ids).toEqual(FIXTURE_SETLIST.songIds.filter((id) => id !== 'fixture-joy'))
  })

  it('is idempotent and leaves an existing setlist alone', () => {
    const s = stateWith(FIXTURE_SETLIST.songIds.map((id) => ({ id })))
    ensureStarterSetlist(s, FIXTURE_SETLIST)
    expect(ensureStarterSetlist(s, FIXTURE_SETLIST)).toBe(false)
    expect(s.data.playlists).toHaveLength(1)
  })

  it('creates nothing when no songs are bundled', () => {
    const s = stateWith([{ id: 'a' }])
    expect(ensureStarterSetlist(s)).toBe(false)
    expect(s.data.playlists).toHaveLength(0)
  })
})
