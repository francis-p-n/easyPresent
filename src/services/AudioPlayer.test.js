import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state } from '../core/StateManager.js'
import { AudioPlayer } from './AudioPlayer.js'

class FakeAudio {
  constructor(src) {
    this.src = src
    this.paused = true
    this.volume = 1
    this.currentTime = 0
    this.duration = 10
    this.loop = false
  }
  play() {
    this.paused = false
    return Promise.resolve()
  }
  pause() {
    this.paused = true
  }
}

let player
let made
const song = { id: 'a1', name: 'Walk-on', src: 'file:///C:/a/walk.mp3', duration: 10 }
const other = { id: 'a2', name: 'Bumper', src: 'file:///C:/a/bump.mp3', duration: 5 }
const audioOff = () => state.set('layers', { ...state.get('layers'), audio: { active: false, content: null } })

beforeEach(() => {
  vi.useFakeTimers()
  made = []
  audioOff()
  state.set('audioPlayback', null)
  player = new AudioPlayer((src) => {
    const a = new FakeAudio(src)
    made.push(a)
    return a
  })
})
afterEach(() => {
  player.stop()
  vi.useRealTimers()
})

describe('AudioPlayer', () => {
  it('plays a file and marks the audio layer live', () => {
    player.play(song)
    expect(made[0].paused).toBe(false)
    expect(state.get('audioPlayback')).toMatchObject({ playing: true, id: 'a1', name: 'Walk-on', duration: 10 })
    expect(state.get('layers').audio.active).toBe(true)
  })

  it('replaces what was playing, and toggling the same file pauses then resumes', () => {
    player.play(song)
    player.play(other)
    expect(made[0].paused).toBe(true)
    expect(state.get('audioPlayback').id).toBe('a2')
    player.toggle(other)
    expect(state.get('audioPlayback').playing).toBe(false)
    player.toggle(other)
    expect(state.get('audioPlayback').playing).toBe(true)
  })

  it('keeps volume and loop, clamps volume, and seeks', () => {
    player.setVolume(5)
    expect(player.volume).toBe(1)
    player.setVolume(0.4)
    player.play(song)
    expect(made[0].volume).toBe(0.4)
    player.setLoop(true)
    expect(made[0].loop).toBe(true)
    player.seek(4)
    expect(state.get('audioPlayback').position).toBe(4)
  })

  it('stop() ends it at once and clears the layer', () => {
    player.play(song)
    player.stop()
    expect(made[0].paused).toBe(true)
    expect(state.get('audioPlayback')).toMatchObject({ playing: false, id: null })
    expect(state.get('layers').audio.active).toBe(false)
  })

  it('fades out over the time given, then stops', () => {
    player.setVolume(0.8)
    player.play(song)
    player.stop({ fadeMs: 1000 })
    vi.advanceTimersByTime(500)
    expect(made[0].volume).toBeLessThan(0.8)
    expect(made[0].paused).toBe(false)
    vi.advanceTimersByTime(600)
    expect(made[0].paused).toBe(true)
    expect(state.get('layers').audio.active).toBe(false)
    expect(player.volume).toBe(0.8) // the slider keeps its place
  })

  it('Clear Audio (the layer going inactive) fades the music out', () => {
    player.play(song)
    audioOff()
    vi.advanceTimersByTime(2000)
    expect(made[0].paused).toBe(true)
    expect(state.get('audioPlayback').playing).toBe(false)
  })

  it('a file that cannot play says so instead of staying "playing"', () => {
    player.play(song)
    made[0].onerror()
    expect(state.get('audioPlayback').error).toContain('Walk-on')
    expect(state.get('audioPlayback').playing).toBe(false)
  })

  it('ignores a missing file', () => {
    player.play(null)
    player.play({ id: 'x', name: 'x' })
    expect(made).toHaveLength(0)
  })
})
