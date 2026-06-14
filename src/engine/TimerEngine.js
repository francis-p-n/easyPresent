import { state } from './StateManager.js'

class TimerEngine {
  constructor() {
    this.timers = new Map()
  }

  startCountdown(id, minutes) {
    this.stop(id)
    const endTime = Date.now() + minutes * 60000
    this.timers.set(id, {
      type: 'countdown',
      endTime,
      running: true,
      interval: setInterval(() => this._tick(id), 100)
    })
  }

  stop(id) {
    const timer = this.timers.get(id)
    if (timer) {
      clearInterval(timer.interval)
      timer.running = false
    }
  }

  reset(id, defaultMinutes = 5) {
    this.stop(id)
    const mins = String(defaultMinutes).padStart(2, '0')
    state.set(`timer_${id}`, `${mins}:00`)
  }

  _tick(id) {
    const timer = this.timers.get(id)
    if (!timer || !timer.running) return
    const remaining = Math.max(0, timer.endTime - Date.now())
    const totalSeconds = Math.ceil(remaining / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    state.set(`timer_${id}`, `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`)
    
    if (remaining === 0) {
      this.stop(id)
    }
  }
}

export const timerEngine = new TimerEngine()
