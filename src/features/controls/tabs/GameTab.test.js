import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { state } from '../../../core/StateManager.js'
import { renderGame } from './GameTab.js'

let container, cleanup

const mount = () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  cleanup = renderGame(container)
}
const q = (sel) => container.querySelector(sel)
const qa = (sel) => [...container.querySelectorAll(sel)]
const stored = () => JSON.parse(localStorage.getItem('campGameState'))

beforeEach(() => {
  localStorage.clear()
  state.set('layers', { ...state.get('layers'), message: { active: false, content: null } })
})
afterEach(() => {
  cleanup?.()
  container?.remove()
  vi.useRealTimers()
})

describe('GameTab — teams', () => {
  it('starts with two teams and can add and remove them', () => {
    mount()
    expect(qa('[data-team]')).toHaveLength(2)
    q('#game-add-team').click()
    q('#game-add-team').click()
    expect(qa('[data-team]')).toHaveLength(4)
    q('[data-team-remove]').click()
    expect(qa('[data-team]')).toHaveLength(3)
    expect(stored().teams).toHaveLength(3)
  })

  it('cannot remove the last team', () => {
    mount()
    q('[data-team-remove]').click()
    expect(q('[data-team-remove]').disabled).toBe(true)
    q('[data-team-remove]').click()
    expect(qa('[data-team]')).toHaveLength(1)
  })

  it('scores by the configured points per tap', () => {
    mount()
    const step = q('#game-step')
    step.value = '5'
    step.dispatchEvent(new window.Event('change'))
    q('[data-score-inc]').click()
    q('[data-score-inc]').click()
    expect(stored().teams[0].score).toBe(10)
    q('[data-score-dec]').click()
    expect(stored().teams[0].score).toBe(5)
  })

  it('shows every team’s score on the message layer', () => {
    mount()
    q('[data-team-name]').value = 'Lions'
    q('[data-team-name]').dispatchEvent(new window.Event('change'))
    q('[data-score-inc]').click()
    q('#game-show-scores').click()
    expect(state.get('layers').message).toEqual({ active: true, content: 'Lions: 1\nTeam B: 0' })
  })

  it('escapes a team name containing markup', () => {
    mount()
    q('[data-team-name]').value = '"><img src=x onerror=alert(1)>'
    q('[data-team-name]').dispatchEvent(new window.Event('change'))
    q('[data-score-inc]').click() // re-render
    expect(container.querySelector('img')).toBeNull()
    expect(q('[data-team-name]').value).toBe('"><img src=x onerror=alert(1)>')
  })

  it('reopens with the saved teams, and understands the old three-team save', () => {
    localStorage.setItem('campGameState', JSON.stringify({ teamA: { name: 'Old A', score: 3, color: '#ef4444' }, teamB: { name: 'Old B', score: 1, color: '#3b82f6' }, activeTeams: 2 }))
    mount()
    expect(qa('[data-team-name]').map((i) => i.value)).toEqual(['Old A', 'Old B'])
  })
})

describe('GameTab — countdown', () => {
  const toCountdown = () => q('[data-mode="countdown"]').click()

  it('lets you set your own shortcuts and reset value', () => {
    mount()
    toCountdown()
    const presets = q('#cd-presets')
    presets.value = '20, 45, 90'
    presets.dispatchEvent(new window.Event('change'))
    expect(qa('[data-cd-preset]').map((b) => b.dataset.cdPreset)).toEqual(['20', '45', '90'])

    const start = q('#cd-start-value')
    start.value = '120'
    start.dispatchEvent(new window.Event('change'))
    expect(q('#cd-reset').textContent).toBe('Reset to 120s')
    q('#cd-reset').click()
    expect(stored().countdown).toBe(120)
  })

  it('counts down to zero and stops', () => {
    vi.useFakeTimers()
    mount()
    toCountdown()
    q('[data-cd-preset="10"]').click()
    q('#cd-start').click()
    vi.advanceTimersByTime(3000)
    expect(stored().countdown).toBe(7)
    vi.advanceTimersByTime(20000)
    expect(stored().countdown).toBe(0)
    expect(stored().countdownRunning).toBe(false)
  })

  it('cleanup stops a running countdown', () => {
    vi.useFakeTimers()
    mount()
    toCountdown()
    q('#cd-start').click()
    cleanup()
    vi.advanceTimersByTime(5000)
    expect(stored().countdown).toBe(30)
  })
})

describe('GameTab — trivia', () => {
  it('shows the question and then the answer', () => {
    mount()
    q('[data-mode="trivia"]').click()
    q('#trivia-question').value = 'Who built the ark?'
    q('#trivia-question').dispatchEvent(new window.Event('input'))
    q('#trivia-answer').value = 'Noah'
    q('#trivia-answer').dispatchEvent(new window.Event('input'))
    q('#show-question').click()
    expect(state.get('layers').message.content).toBe('Who built the ark?')
    q('#show-answer').click()
    expect(state.get('layers').message.content).toBe('Noah')
  })
})
