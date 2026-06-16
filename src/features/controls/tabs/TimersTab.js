import { state } from '../../../engine/StateManager.js'
import { timerEngine } from '../../../engine/TimerEngine.js'

export function renderTimers(content, container) {
  content.innerHTML = `
    <div class="show-controls-section">
      <div class="timer-display" id="timer-display">
        <div class="timer-display__time">00:00</div>
        <div class="timer-display__label">Countdown Timer</div>
      </div>
      <div class="timer-controls">
        <button class="btn btn--primary" id="timer-start">Start</button>
        <button class="btn" id="timer-stop">Stop</button>
        <button class="btn" id="timer-reset">Reset</button>
      </div>
      <div class="timer-presets">
        <button class="btn timer-preset" data-minutes="1">1 min</button>
        <button class="btn timer-preset" data-minutes="3">3 min</button>
        <button class="btn timer-preset" data-minutes="5">5 min</button>
        <button class="btn timer-preset" data-minutes="10">10 min</button>
      </div>
    </div>
  `

  // Listen for timer updates
  const unsub = state.on('timer_main', (timeStr) => {
    const display = container.querySelector('.timer-display__time')
    if (display) display.textContent = timeStr
  })

  // Return cleanup function
  return () => {
    unsub()
  }
}
