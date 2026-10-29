import { state } from '../core/StateManager.js'

const FADE_STEP_MS = 50

/**
 * AudioPlayer — plays one audio file at a time through this computer's sound output (walk-in music,
 * a bumper, a backing track). Starting another file replaces the one playing. "Clear audio" and
 * `stop({ fadeMs })` fade it out instead of cutting it off.
 *
 * What the controls draw lives in the `audioPlayback` state: { playing, id, name, position, duration,
 * volume, loop }. The `layers.audio` entry mirrors whether something is playing, so the Clear Audio
 * button and the F7 shortcut work like every other layer.
 */
export class AudioPlayer {
  constructor(createAudio = (src) => new window.Audio(src)) {
    this.createAudio = createAudio
    this.audio = null
    this.volume = 1
    this.loop = false
    this.fade = null
    this.item = null
    this.settingLayer = false
    // Clearing the audio layer (button, F7, remote) fades the music out
    state.on('layers', (layers) => {
      if (this.settingLayer) return
      if (this.audio && !(layers && layers.audio && layers.audio.active)) this.stop({ fadeMs: 1500 })
    })
  }

  _publish(extra = {}) {
    const a = this.audio
    state.set('audioPlayback', {
      playing: !!a && !a.paused,
      id: this.item ? this.item.id : null,
      name: this.item ? this.item.name : '',
      position: a ? a.currentTime || 0 : 0,
      duration: a && Number.isFinite(a.duration) ? a.duration : (this.item && this.item.duration) || 0,
      volume: this.volume,
      loop: this.loop,
      ...extra
    })
  }

  _setLayer(active) {
    this.settingLayer = true
    const layers = { ...state.get('layers') }
    layers.audio = active ? { active: true, content: { id: this.item.id, name: this.item.name } } : { active: false, content: null }
    state.set('layers', layers)
    this.settingLayer = false
  }

  _release() {
    if (this.fade) clearInterval(this.fade)
    this.fade = null
    if (this.audio) {
      this.audio.pause()
      this.audio.onended = this.audio.ontimeupdate = this.audio.onloadedmetadata = this.audio.onerror = null
    }
    this.audio = null
  }

  /** Starts `item` ({ id, name, src }) from the beginning, replacing whatever was playing. */
  play(item) {
    if (!item || !item.src) return
    this._release()
    this.item = item
    const audio = this.createAudio(item.src)
    this.audio = audio
    audio.volume = this.volume
    audio.loop = this.loop
    audio.ontimeupdate = () => this._publish()
    audio.onloadedmetadata = () => this._publish()
    audio.onended = () => {
      if (!this.loop) this.stop()
    }
    audio.onerror = () => {
      this.stop()
      state.set('audioPlayback', { ...state.get('audioPlayback'), error: `Couldn't play ${item.name}. Is the file still where it was?` })
    }
    const started = audio.play()
    if (started && started.catch) started.catch(() => audio.onerror && audio.onerror())
    this._setLayer(true)
    this._publish({ playing: true, position: 0, error: '' })
  }

  pause() {
    if (!this.audio) return
    this.audio.pause()
    this._publish({ playing: false })
  }

  resume() {
    if (!this.audio) return
    const started = this.audio.play()
    if (started && started.catch) started.catch(() => {})
    this._publish({ playing: true })
  }

  toggle(item) {
    if (this.audio && this.item && item && this.item.id === item.id) {
      if (this.audio.paused) this.resume()
      else this.pause()
    } else this.play(item)
  }

  seek(seconds) {
    if (!this.audio || !Number.isFinite(seconds)) return
    this.audio.currentTime = Math.max(0, seconds)
    this._publish()
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, Number(v) || 0))
    if (this.audio && !this.fade) this.audio.volume = this.volume
    if (this.audio) this._publish()
    else state.set('audioPlayback', { ...(state.get('audioPlayback') || {}), volume: this.volume })
  }

  setLoop(on) {
    this.loop = !!on
    if (this.audio) this.audio.loop = this.loop
    this._publish()
  }

  /** Stops playing, fading out over `fadeMs` first when given. */
  stop({ fadeMs = 0 } = {}) {
    const audio = this.audio
    if (!audio) return
    const finish = () => {
      this._release()
      const had = this.item
      this.item = null
      if (had) this._setLayer(false)
      this._publish({ playing: false, position: 0, id: null, name: '' })
    }
    if (!(fadeMs > 0) || audio.paused) return finish()
    if (this.fade) return // already fading
    const steps = Math.max(1, Math.round(fadeMs / FADE_STEP_MS))
    let n = 0
    const start = audio.volume
    this.fade = setInterval(() => {
      n++
      audio.volume = Math.max(0, start * (1 - n / steps))
      if (n >= steps) finish()
    }, FADE_STEP_MS)
  }
}

export const audioPlayer = new AudioPlayer()
