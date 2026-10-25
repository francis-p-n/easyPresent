import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSongSync, toRecord, fromRecord, isSong } from './songSync.js'
import { parseChordProToSlides, slidesToChordPro } from './chordpro.js'

function fakeState(init = {}) {
  const data = { presentations: [], ...init }
  const listeners = {}
  return {
    data,
    get: (k) => data[k],
    set: (k, v) => {
      data[k] = v
      ;(listeners[k] || []).forEach((cb) => cb(v))
    },
    on: (k, cb) => (listeners[k] = [...(listeners[k] || []), cb])
  }
}

function fakeApi(rows = []) {
  return {
    rows,
    songsList: vi.fn(async () => rows),
    songsUpsert: vi.fn(async (songs) => {
      for (const s of songs) {
        const i = rows.findIndex((r) => r.id === s.id)
        if (i >= 0) rows[i] = s
        else rows.push(s)
      }
    }),
    songsRemove: vi.fn(async (ids) => {
      ids.forEach((id) => rows.splice(rows.findIndex((r) => r.id === id), 1))
    })
  }
}

const rec = (id, chordpro, over = {}) => ({ id, title: `T ${id}`, category: 'Worship', key: 'G', chordpro, updatedAt: 1000, ...over })

describe('ChordPro round trip', () => {
  it('rebuilds identical slides from stored text', () => {
    const slides = parseChordProToSlides('[Verse 1]\n[G]One [C]two\nthree\n\n[Chorus]\n[D]Four')
    const again = parseChordProToSlides(slidesToChordPro(slides))
    expect(again.map((s) => [s.label, s.text, s.linesData])).toEqual(slides.map((s) => [s.label, s.text, s.linesData]))
  })

  it('toRecord / fromRecord preserve identity and metadata', () => {
    const pres = { id: 'x', name: 'My Song', category: 'Hymns', key: 'D', slides: parseChordProToSlides('[Verse 1]\n[D]Hi') }
    const back = fromRecord(toRecord(pres, 5))
    expect(back).toMatchObject({ id: 'x', name: 'My Song', category: 'Hymns', key: 'D' })
    expect(back.slides[0].linesData[0].chords).toEqual([{ pos: 0, chord: 'D' }])
  })

  it('only songs are mirrored', () => {
    expect(isSong({ category: 'Worship' })).toBe(true)
    expect(isSong({ category: 'Hymns' })).toBe(true)
    expect(isSong({ category: 'Announcements' })).toBe(false)
  })
})

describe('createSongSync', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('pull adds charts the library is missing and leaves existing ones alone', async () => {
    const state = fakeState({ presentations: [{ id: 'a', name: 'Mine', category: 'Worship', slides: [] }] })
    const api = fakeApi([rec('a', '[Verse 1]\nold'), rec('b', '[Verse 1]\n[G]new')])
    const sync = createSongSync({ state, api })

    expect(await sync.pull()).toBe(1)
    expect(state.data.presentations.map((p) => p.id)).toEqual(['a', 'b'])
    expect(state.data.presentations[0].name).toBe('Mine')
  })

  it('mirrors an edited song and only that song', async () => {
    const state = fakeState({ presentations: [{ id: 'a', name: 'A', category: 'Worship', slides: parseChordProToSlides('[Verse 1]\nline') }] })
    const api = fakeApi([rec('a', '[Verse 1]\nline', { title: 'A', key: null })])
    const sync = createSongSync({ state, api })
    await sync.pull()
    sync.start()

    state.set('presentations', [{ ...state.data.presentations[0], name: 'A renamed' }])
    await vi.advanceTimersByTimeAsync(1000)

    expect(api.songsUpsert).toHaveBeenCalledTimes(1)
    expect(api.songsUpsert.mock.calls[0][0].map((r) => [r.id, r.title])).toEqual([['a', 'A renamed']])
  })

  it('does not write back unchanged songs', async () => {
    const pres = { id: 'a', name: 'T a', category: 'Worship', key: 'G', slides: parseChordProToSlides('[Verse 1]\nline') }
    const api = fakeApi([toRecord(pres, 1)])
    const state = fakeState({ presentations: [pres] })
    const sync = createSongSync({ state, api })
    await sync.pull()
    await sync.mirror()
    expect(api.songsUpsert).not.toHaveBeenCalled()
  })

  it('removes a chart from the database when the song is deleted from the library', async () => {
    const pres = { id: 'a', name: 'T a', category: 'Worship', key: 'G', slides: parseChordProToSlides('[Verse 1]\nline') }
    const api = fakeApi([toRecord(pres, 1)])
    const state = fakeState({ presentations: [pres] })
    const sync = createSongSync({ state, api })
    await sync.pull()
    sync.start()

    state.set('presentations', [])
    await vi.advanceTimersByTimeAsync(1000)
    expect(api.songsRemove).toHaveBeenCalledWith(['a'])
  })

  it('a newer copy arriving via import replaces the library version', async () => {
    const pres = { id: 'a', name: 'T a', category: 'Worship', key: 'G', slides: parseChordProToSlides('[Verse 1]\nold') }
    const api = fakeApi([toRecord(pres, 1000)])
    const state = fakeState({ presentations: [pres] })
    const sync = createSongSync({ state, api })
    await sync.pull()

    api.rows[0] = rec('a', '[Verse 1]\nnewer text', { updatedAt: 5000, title: 'T a' })
    expect(await sync.pull()).toBe(1)
    expect(state.data.presentations[0].slides[0].text).toBe('newer text')
  })
})
