import { state } from '../../../core/StateManager.js'
import {
  normalizeGame,
  parsePresets,
  addTeam,
  removeTeam,
  bumpScore,
  resetScores,
  scoresText,
  MAX_TEAMS
} from './gameModel.js'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * GameTab — Live game controls: any number of teams with their own names and colours,
 * a configurable points-per-tap, trivia questions, and a countdown with your own shortcuts.
 */
export function renderGame(container) {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('campGameState')) } catch { return null }
  })()

  let game = normalizeGame(saved)
  let countdownInterval = null

  function save() {
    try { localStorage.setItem('campGameState', JSON.stringify(game)) } catch { /* quota */ }
  }

  function broadcastText(text) {
    const layers = { ...state.get('layers') }
    layers.message = { active: true, content: text }
    state.set('layers', layers)
  }

  const set = (next) => { game = next; save(); render() }

  function render() {
    const modeBar = ['scores', 'trivia', 'countdown'].map((m) => {
      const active = game.mode === m
      return `<button data-mode="${m}" style="flex:1;padding:5px;border-radius:4px;border:none;cursor:pointer;min-height:26px;background:${active ? 'var(--accent-blue-strong)' : 'transparent'};color:${active ? 'white' : '#a8adb8'};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${m}</button>`
    }).join('')

    let modeContent = ''

    if (game.mode === 'scores') {
      const scoreCards = game.teams.map((team) => `
          <div data-team="${esc(team.id)}" style="background:var(--bg-active);border-radius:8px;padding:10px;border-left:4px solid ${team.color};">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">
              <input data-team-name="${esc(team.id)}" value="${esc(team.name)}" maxlength="40" aria-label="Team name" style="background:transparent;border:none;color:var(--text-primary);font-weight:600;font-size:13px;flex:1;min-width:0;outline:none;border-bottom:1px solid var(--border-color);" />
              <input type="color" data-team-color="${esc(team.id)}" value="${team.color}" aria-label="Team colour" style="width:28px;height:28px;border-radius:4px;border:none;cursor:pointer;" />
              <button data-team-remove="${esc(team.id)}" aria-label="Remove team" title="Remove team" ${game.teams.length <= 1 ? 'disabled' : ''} style="width:28px;height:28px;border-radius:4px;border:1px solid var(--border-color);background:transparent;color:var(--text-secondary);cursor:pointer;">&#x2715;</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;justify-content:center;">
              <button data-score-dec="${esc(team.id)}" aria-label="Subtract points" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-panel);cursor:pointer;font-size:20px;color:var(--text-primary);line-height:1;">&#x2212;</button>
              <span style="font-size:36px;font-weight:700;color:${team.color};min-width:60px;text-align:center;">${team.score}</span>
              <button data-score-inc="${esc(team.id)}" aria-label="Add points" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-panel);cursor:pointer;font-size:20px;color:var(--text-primary);line-height:1;">&#x2B;</button>
            </div>
          </div>
        `).join('')

      modeContent = `
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-secondary);flex-wrap:wrap;">
          <button id="game-add-team" class="btn" style="font-size:12px;" ${game.teams.length >= MAX_TEAMS ? 'disabled' : ''}>+ Team</button>
          <label style="display:flex;align-items:center;gap:4px;">Points per tap
            <input id="game-step" type="number" min="1" max="1000" value="${game.step}" class="input" style="width:64px;font-size:12px;" />
          </label>
        </div>
        ${scoreCards}
        <div style="display:flex;gap:6px;">
          <button id="game-show-scores" class="btn btn--primary" style="flex:1;font-size:12px;">Show Scores</button>
          <button id="game-reset-scores" class="btn" style="flex:1;font-size:12px;">Reset All</button>
        </div>
      `
    }

    if (game.mode === 'trivia') {
      modeContent = `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="font-size:12px;color:var(--text-secondary);">
            Question
            <textarea id="trivia-question" class="input" rows="3" style="resize:vertical;margin-top:4px;font-size:13px;">${esc(game.triviaQuestion)}</textarea>
          </label>
          <label style="font-size:12px;color:var(--text-secondary);">
            Answer
            <textarea id="trivia-answer" class="input" rows="2" style="resize:vertical;margin-top:4px;font-size:13px;">${esc(game.triviaAnswer)}</textarea>
          </label>
          <div style="display:flex;gap:6px;">
            <button id="show-question" class="btn btn--primary" style="flex:1;font-size:12px;">Show Question</button>
            <button id="show-answer" class="btn" style="flex:1;font-size:12px;">Reveal Answer</button>
          </div>
        </div>
      `
    }

    if (game.mode === 'countdown') {
      const cdColor = game.countdown <= 5 ? '#ef4444' : 'var(--text-primary)'
      const presetBtns = game.presets.map((s) => {
        const active = game.countdown === s && !game.countdownRunning
        return `<button data-cd-preset="${s}" style="padding:3px 7px;border-radius:4px;border:1px solid var(--border-color);cursor:pointer;font-size:12px;background:${active ? 'var(--accent-blue)' : 'transparent'};color:${active ? 'white' : 'var(--text-secondary)'};">${s}s</button>`
      }).join('')

      modeContent = `
        <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
          <div style="font-size:56px;font-weight:700;color:${cdColor};font-variant-numeric:tabular-nums;line-height:1;">
            ${game.countdown}s
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;">
            ${presetBtns}
          </div>
          <div style="display:flex;gap:6px;width:100%;">
            <button id="cd-start" class="btn btn--primary" style="flex:1;">${game.countdownRunning ? 'Pause' : 'Start'}</button>
            <button id="cd-reset" class="btn" style="flex:1;">Reset to ${game.countdownStart}s</button>
          </div>
          <div style="display:flex;gap:8px;width:100%;font-size:12px;color:var(--text-secondary);flex-wrap:wrap;">
            <label style="flex:2;min-width:120px;">Shortcuts (seconds)
              <input id="cd-presets" class="input" value="${esc(game.presets.join(', '))}" style="font-size:12px;width:100%;" />
            </label>
            <label style="flex:1;min-width:80px;">Reset value
              <input id="cd-start-value" type="number" min="1" max="3600" class="input" value="${game.countdownStart}" style="font-size:12px;width:100%;" />
            </label>
          </div>
        </div>
      `
    }

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;padding:4px;">
        <div style="display:flex;gap:4px;background:var(--bg-active);border-radius:6px;padding:3px;">
          ${modeBar}
        </div>
        ${modeContent}
      </div>
    `

    // Mode switching
    container.querySelectorAll('[data-mode]').forEach((btn) => {
      btn.addEventListener('click', () => set({ ...game, mode: btn.dataset.mode }))
    })

    // Teams
    container.querySelector('#game-add-team')?.addEventListener('click', () => set(addTeam(game)))
    container.querySelectorAll('[data-team-remove]').forEach((btn) => {
      btn.addEventListener('click', () => set(removeTeam(game, btn.dataset.teamRemove)))
    })
    const step = container.querySelector('#game-step')
    if (step) {
      step.addEventListener('change', () => {
        const n = Math.round(Number(step.value))
        set({ ...game, step: Number.isFinite(n) && n >= 1 ? Math.min(1000, n) : 1 })
      })
    }

    // Score +/-
    container.querySelectorAll('[data-score-inc]').forEach((btn) => {
      btn.addEventListener('click', () => set(bumpScore(game, btn.dataset.scoreInc, +1)))
    })
    container.querySelectorAll('[data-score-dec]').forEach((btn) => {
      btn.addEventListener('click', () => set(bumpScore(game, btn.dataset.scoreDec, -1)))
    })

    // Team name / colour (a name edit must not rebuild the DOM under the cursor)
    container.querySelectorAll('[data-team-name]').forEach((input) => {
      input.addEventListener('change', () => {
        game = { ...game, teams: game.teams.map((t) => (t.id === input.dataset.teamName ? { ...t, name: input.value } : t)) }
        save()
      })
    })
    container.querySelectorAll('[data-team-color]').forEach((input) => {
      input.addEventListener('input', () => {
        game = { ...game, teams: game.teams.map((t) => (t.id === input.dataset.teamColor ? { ...t, color: input.value } : t)) }
        save(); render()
      })
    })

    container.querySelector('#game-show-scores')?.addEventListener('click', () => broadcastText(scoresText(game)))
    container.querySelector('#game-reset-scores')?.addEventListener('click', () => set(resetScores(game)))

    // Trivia
    const triviaQ = container.querySelector('#trivia-question')
    if (triviaQ) triviaQ.addEventListener('input', () => { game = { ...game, triviaQuestion: triviaQ.value }; save() })

    const triviaA = container.querySelector('#trivia-answer')
    if (triviaA) triviaA.addEventListener('input', () => { game = { ...game, triviaAnswer: triviaA.value }; save() })

    container.querySelector('#show-question')?.addEventListener('click', () => broadcastText(game.triviaQuestion))
    container.querySelector('#show-answer')?.addEventListener('click', () => broadcastText(game.triviaAnswer))

    // Countdown
    container.querySelectorAll('[data-cd-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!game.countdownRunning) set({ ...game, countdown: parseInt(btn.dataset.cdPreset, 10) })
      })
    })

    container.querySelector('#cd-presets')?.addEventListener('change', (e) => set({ ...game, presets: parsePresets(e.target.value) }))
    container.querySelector('#cd-start-value')?.addEventListener('change', (e) => {
      const n = Math.round(Number(e.target.value))
      set({ ...game, countdownStart: Number.isFinite(n) && n > 0 ? Math.min(3600, n) : 30 })
    })

    const cdStart = container.querySelector('#cd-start')
    if (cdStart) {
      cdStart.addEventListener('click', () => {
        if (game.countdownRunning) {
          clearInterval(countdownInterval)
          countdownInterval = null
          game = { ...game, countdownRunning: false }
        } else if (game.countdown > 0) {
          game = { ...game, countdownRunning: true }
          countdownInterval = setInterval(() => {
            const left = game.countdown - 1
            if (left <= 0) {
              clearInterval(countdownInterval)
              countdownInterval = null
              game = { ...game, countdown: 0, countdownRunning: false }
            } else {
              game = { ...game, countdown: left }
            }
            save()
            render()
          }, 1000)
        }
        save(); render()
      })
    }

    container.querySelector('#cd-reset')?.addEventListener('click', () => {
      clearInterval(countdownInterval)
      countdownInterval = null
      set({ ...game, countdownRunning: false, countdown: game.countdownStart })
    })
  }

  render()

  // Return cleanup so ShowControls can call it on tab switch
  return () => {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}
