import { describe, it, expect } from 'vitest'
import { buildLiveState, nextSongTitle } from './liveState.js'

const pres = {
  title: 'Sunday',
  slides: [
    { id: 'a', label: 'Verse 1', text: 'one' },
    { id: 'b', label: 'Chorus', text: 'two' }
  ]
}
const on = (slide) => ({ slide: { active: true, content: slide }, message: { active: false, content: null } })

describe('buildLiveState', () => {
  it('reports current and next slide while on air', () => {
    const s = buildLiveState({ presentation: pres, liveIndex: 0, layers: on(pres.slides[0]) })
    expect(s.onAir).toBe(true)
    expect(s.current).toEqual({ label: 'Verse 1', text: 'one' })
    expect(s.next).toEqual({ label: 'Chorus', text: 'two' })
    expect(s.index).toBe(0)
    expect(s.total).toBe(2)
    expect(s.title).toBe('Sunday')
  })

  it('has no next slide on the last one', () => {
    const s = buildLiveState({ presentation: pres, liveIndex: 1, layers: on(pres.slides[1]) })
    expect(s.next).toBeNull()
  })

  it('reports cleared output', () => {
    const layers = { slide: { active: false, content: null }, message: { active: false } }
    const s = buildLiveState({ presentation: pres, liveIndex: 0, layers })
    expect(s.onAir).toBe(false)
    expect(s.current).toBeNull()
    expect(s.next).toBeNull()
  })

  it('resolves the {timer} token and logo flag', () => {
    const layers = { slide: { active: false }, message: { active: true, content: 'Starts in {timer}' } }
    const s = buildLiveState({ presentation: null, liveIndex: -1, layers, showLogo: true, timerValue: '04:59' })
    expect(s.message).toBe('Starts in 04:59')
    expect(s.showLogo).toBe(true)
  })
})

describe('nextSongTitle', () => {
  const songs = [
    { id: 'a', name: 'Amazing Grace' },
    { id: 'b', name: 'How Great', title: 'How Great Is Our God' },
    { id: 'c', name: 'Reasons' }
  ]
  const playlist = { items: [{ type: 'header', text: 'Worship' }, { type: 'presentation', id: 'a' }, { type: 'note', text: 'n' }, { type: 'presentation', id: 'b' }, { type: 'presentation', id: 'c' }] }

  it('names the next song, skipping headers and notes', () => {
    expect(nextSongTitle(playlist, songs, 'a')).toBe('How Great Is Our God')
    expect(nextSongTitle(playlist, songs, 'b')).toBe('Reasons')
  })

  it('is blank on the last song, for a song outside the list, and with no list', () => {
    expect(nextSongTitle(playlist, songs, 'c')).toBe('')
    expect(nextSongTitle(playlist, songs, 'zzz')).toBe('')
    expect(nextSongTitle(null, songs, 'a')).toBe('')
  })

  it('travels in the live state', () => {
    expect(buildLiveState({ presentation: null, layers: {}, nextSong: 'Reasons' }).nextSong).toBe('Reasons')
    expect(buildLiveState({ presentation: null, layers: {} }).nextSong).toBe('')
  })
})
