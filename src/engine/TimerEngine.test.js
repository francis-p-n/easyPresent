import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { timerEngine } from './TimerEngine.js'
import { state } from './StateManager.js'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  timerEngine.stop('t1')
  vi.useRealTimers()
})

describe('TimerEngine', () => {
  it('counts down and publishes mm:ss to state', () => {
    timerEngine.startCountdown('t1', 1) // 1 minute
    vi.advanceTimersByTime(100)
    expect(state.get('timer_t1')).toBe('01:00')

    vi.advanceTimersByTime(30000)
    expect(state.get('timer_t1')).toBe('00:30')
  })

  it('reaches 00:00 and stops itself', () => {
    timerEngine.startCountdown('t1', 1)
    vi.advanceTimersByTime(61000)
    expect(state.get('timer_t1')).toBe('00:00')

    // No further updates once stopped
    state.set('timer_t1', 'sentinel')
    vi.advanceTimersByTime(5000)
    expect(state.get('timer_t1')).toBe('sentinel')
  })

  it('stop() freezes the countdown', () => {
    timerEngine.startCountdown('t1', 5)
    vi.advanceTimersByTime(1000)
    const frozen = state.get('timer_t1')
    timerEngine.stop('t1')
    vi.advanceTimersByTime(10000)
    expect(state.get('timer_t1')).toBe(frozen)
  })

  it('reset() stops and restores the default display', () => {
    timerEngine.startCountdown('t1', 1)
    vi.advanceTimersByTime(5000)
    timerEngine.reset('t1', 5)
    expect(state.get('timer_t1')).toBe('05:00')
    vi.advanceTimersByTime(5000)
    expect(state.get('timer_t1')).toBe('05:00') // stays frozen
  })

  it('restarting an id replaces the previous countdown', () => {
    timerEngine.startCountdown('t1', 1)
    vi.advanceTimersByTime(30000)
    timerEngine.startCountdown('t1', 2)
    vi.advanceTimersByTime(100)
    expect(state.get('timer_t1')).toBe('02:00')
  })
})
