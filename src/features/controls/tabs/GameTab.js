import { state } from '../../../core/StateManager.js'

/**
 * GameTab — Live camp game controls: team scores, trivia questions, countdown timer.
 */
export function renderGame(container) {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('campGameState')) } catch { return null }
  })()

  const gameState = saved || {
    teamA: { name: 'Team A', score: 0, color: '#ef4444' },
    teamB: { name: 'Team B', score: 0, color: '#3b82f6' },
    teamC: { name: 'Team C', score: 0, color: '#22c55e' },
    activeTeams: 2,
    countdown: 30,
    countdownRunning: false,
    triviaQuestion: '',
    triviaAnswer: '',
    mode: 'scores',
  }

  let countdownInterval = null

  function save() {
    try { localStorage.setItem('campGameState', JSON.stringify(gameState)) } catch { /* quota */ }
  }

  function broadcastText(text) {
    const layers = { ...state.get('layers') }
    layers.message = { active: true, content: text }
    state.set('layers', layers)
  }

  function getTeams() {
    return [gameState.teamA, gameState.teamB, gameState.teamC].slice(0, gameState.activeTeams)
  }

  function teamKey(i) { return ['teamA', 'teamB', 'teamC'][i] }

  function render() {
    const teams = getTeams()

    const modeBar = ['scores', 'trivia', 'countdown'].map(m => {
      const active = gameState.mode === m
      return `<button data-mode="${m}" style="flex:1;padding:5px;border-radius:4px;border:none;cursor:pointer;background:${active ? 'var(--accent-blue)' : 'transparent'};color:${active ? 'white' : 'var(--text-secondary)'};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${m}</button>`
    }).join('')

    let modeContent = ''

    if (gameState.mode === 'scores') {
      const teamCountBtns = [2, 3].map(n => {
        const active = gameState.activeTeams === n
        return `<button data-teams="${n}" style="padding:3px 8px;border-radius:4px;border:1px solid var(--border-color);cursor:pointer;background:${active ? 'var(--accent-blue)' : 'transparent'};color:${active ? 'white' : 'var(--text-secondary)'};font-size:11px;">${n}</button>`
      }).join('')

      const scoreCards = teams.map((team, i) => {
        const key = teamKey(i)
        return `
          <div style="background:var(--bg-active);border-radius:8px;padding:10px;border-left:4px solid ${team.color};">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <input data-team-name="${key}" value="${team.name.replace(/"/g, '&quot;')}" style="background:transparent;border:none;color:var(--text-primary);font-weight:600;font-size:13px;width:120px;outline:none;border-bottom:1px solid var(--border-color);" />
              <input type="color" data-team-color="${key}" value="${team.color}" style="width:28px;height:28px;border-radius:4px;border:none;cursor:pointer;" />
            </div>
            <div style="display:flex;align-items:center;gap:8px;justify-content:center;">
              <button data-score-dec="${key}" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-panel);cursor:pointer;font-size:20px;color:var(--text-primary);line-height:1;">&#x2212;</button>
              <span style="font-size:36px;font-weight:700;color:${team.color};min-width:60px;text-align:center;">${team.score}</span>
              <button data-score-inc="${key}" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--border-color);background:var(--bg-panel);cursor:pointer;font-size:20px;color:var(--text-primary);line-height:1;">&#x2B;</button>
            </div>
          </div>
        `
      }).join('')

      modeContent = `
        <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-secondary);">
          Teams: ${teamCountBtns}
        </div>
        ${scoreCards}
        <div style="display:flex;gap:6px;">
          <button id="game-show-scores" class="btn btn--primary" style="flex:1;font-size:11px;">Show Scores</button>
          <button id="game-reset-scores" class="btn" style="flex:1;font-size:11px;">Reset All</button>
        </div>
      `
    }

    if (gameState.mode === 'trivia') {
      modeContent = `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label style="font-size:11px;color:var(--text-secondary);">
            Question
            <textarea id="trivia-question" class="input" rows="3" style="resize:vertical;margin-top:4px;font-size:13px;">${gameState.triviaQuestion.replace(/</g, '&lt;')}</textarea>
          </label>
          <label style="font-size:11px;color:var(--text-secondary);">
            Answer
            <textarea id="trivia-answer" class="input" rows="2" style="resize:vertical;margin-top:4px;font-size:13px;">${gameState.triviaAnswer.replace(/</g, '&lt;')}</textarea>
          </label>
          <div style="display:flex;gap:6px;">
            <button id="show-question" class="btn btn--primary" style="flex:1;font-size:11px;">Show Question</button>
            <button id="show-answer" class="btn" style="flex:1;font-size:11px;">Reveal Answer</button>
          </div>
        </div>
      `
    }

    if (gameState.mode === 'countdown') {
      const cdColor = gameState.countdown <= 5 ? '#ef4444' : 'var(--text-primary)'
      const presetBtns = [10, 15, 30, 60].map(s => {
        const active = gameState.countdown === s && !gameState.countdownRunning
        return `<button data-cd-preset="${s}" style="padding:3px 7px;border-radius:4px;border:1px solid var(--border-color);cursor:pointer;font-size:11px;background:${active ? 'var(--accent-blue)' : 'transparent'};color:${active ? 'white' : 'var(--text-secondary)'};">${s}s</button>`
      }).join('')

      modeContent = `
        <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
          <div style="font-size:56px;font-weight:700;color:${cdColor};font-variant-numeric:tabular-nums;line-height:1;">
            ${gameState.countdown}s
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;">
            ${presetBtns}
          </div>
          <div style="display:flex;gap:6px;width:100%;">
            <button id="cd-start" class="btn btn--primary" style="flex:1;">${gameState.countdownRunning ? 'Pause' : 'Start'}</button>
            <button id="cd-reset" class="btn" style="flex:1;">Reset</button>
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
    container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        gameState.mode = btn.dataset.mode
        save()
        render()
      })
    })

    // Team count
    container.querySelectorAll('[data-teams]').forEach(btn => {
      btn.addEventListener('click', () => {
        gameState.activeTeams = parseInt(btn.dataset.teams, 10)
        save(); render()
      })
    })

    // Score +/-
    container.querySelectorAll('[data-score-inc]').forEach(btn => {
      btn.addEventListener('click', () => {
        gameState[btn.dataset.scoreInc].score++
        save(); render()
      })
    })
    container.querySelectorAll('[data-score-dec]').forEach(btn => {
      btn.addEventListener('click', () => {
        gameState[btn.dataset.scoreDec].score = Math.max(0, gameState[btn.dataset.scoreDec].score - 1)
        save(); render()
      })
    })

    // Team name / color
    container.querySelectorAll('[data-team-name]').forEach(input => {
      input.addEventListener('change', () => {
        gameState[input.dataset.teamName].name = input.value
        save()
      })
    })
    container.querySelectorAll('[data-team-color]').forEach(input => {
      input.addEventListener('input', () => {
        gameState[input.dataset.teamColor].color = input.value
        save(); render()
      })
    })

    // Show scores
    const showScoresBtn = container.querySelector('#game-show-scores')
    if (showScoresBtn) {
      showScoresBtn.addEventListener('click', () => {
        const text = getTeams().map(t => `${t.name}: ${t.score}`).join('\n')
        broadcastText(text)
      })
    }

    const resetBtn = container.querySelector('#game-reset-scores')
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        gameState.teamA.score = 0
        gameState.teamB.score = 0
        gameState.teamC.score = 0
        save(); render()
      })
    }

    // Trivia
    const triviaQ = container.querySelector('#trivia-question')
    if (triviaQ) triviaQ.addEventListener('input', () => { gameState.triviaQuestion = triviaQ.value; save() })

    const triviaA = container.querySelector('#trivia-answer')
    if (triviaA) triviaA.addEventListener('input', () => { gameState.triviaAnswer = triviaA.value; save() })

    const showQ = container.querySelector('#show-question')
    if (showQ) showQ.addEventListener('click', () => broadcastText(gameState.triviaQuestion))

    const showAns = container.querySelector('#show-answer')
    if (showAns) showAns.addEventListener('click', () => broadcastText(gameState.triviaAnswer))

    // Countdown presets
    container.querySelectorAll('[data-cd-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!gameState.countdownRunning) {
          gameState.countdown = parseInt(btn.dataset.cdPreset, 10)
          save(); render()
        }
      })
    })

    const cdStart = container.querySelector('#cd-start')
    if (cdStart) {
      cdStart.addEventListener('click', () => {
        if (gameState.countdownRunning) {
          clearInterval(countdownInterval)
          countdownInterval = null
          gameState.countdownRunning = false
        } else if (gameState.countdown > 0) {
          gameState.countdownRunning = true
          countdownInterval = setInterval(() => {
            gameState.countdown--
            save()
            if (gameState.countdown <= 0) {
              clearInterval(countdownInterval)
              countdownInterval = null
              gameState.countdownRunning = false
              gameState.countdown = 0
            }
            render()
          }, 1000)
        }
        save(); render()
      })
    }

    const cdReset = container.querySelector('#cd-reset')
    if (cdReset) {
      cdReset.addEventListener('click', () => {
        clearInterval(countdownInterval)
        countdownInterval = null
        gameState.countdownRunning = false
        gameState.countdown = 30
        save(); render()
      })
    }
  }

  render()

  // Return cleanup so ShowControls can call it on tab switch
  return () => {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}
