/**
 * gameModel — the camp game state as plain data, so every part of it is configurable
 * (any number of teams, the points per tap, the countdown shortcuts) and testable
 * without a DOM.
 */

export const MAX_TEAMS = 12
export const DEFAULT_PRESETS = [10, 15, 30, 60]
const PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#ec4899', '#84cc16', '#f97316', '#06b6d4', '#8b5cf6', '#eab308']

let seq = 0
const newId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`

const team = (index, extra = {}) => ({
  id: newId(),
  name: `Team ${String.fromCharCode(65 + (index % 26))}${index >= 26 ? Math.floor(index / 26) : ''}`,
  score: 0,
  color: PALETTE[index % PALETTE.length],
  ...extra
})

export function defaultGame() {
  return {
    teams: [team(0), team(1)],
    step: 1,
    presets: [...DEFAULT_PRESETS],
    countdownStart: 30,
    countdown: 30,
    countdownRunning: false,
    triviaQuestion: '',
    triviaAnswer: '',
    mode: 'scores'
  }
}

/** Accepts the current shape, the old teamA/teamB/teamC shape, or junk. Always returns a usable game. */
export function normalizeGame(saved) {
  const base = defaultGame()
  if (!saved || typeof saved !== 'object') return base
  let teams = null
  if (Array.isArray(saved.teams) && saved.teams.length) {
    teams = saved.teams.slice(0, MAX_TEAMS).map((t, i) => ({
      id: String(t.id || newId()),
      name: String(t.name ?? '').slice(0, 40) || `Team ${i + 1}`,
      score: Number.isFinite(t.score) ? Math.max(0, Math.round(t.score)) : 0,
      color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : PALETTE[i % PALETTE.length]
    }))
  } else if (saved.teamA) {
    const count = Math.min(3, Math.max(1, saved.activeTeams || 2))
    teams = ['teamA', 'teamB', 'teamC']
      .slice(0, count)
      .map((k, i) => saved[k] && { id: newId(), name: saved[k].name || `Team ${i + 1}`, score: Math.max(0, saved[k].score || 0), color: saved[k].color || PALETTE[i] })
      .filter(Boolean)
  }
  const step = Number.isFinite(saved.step) && saved.step >= 1 ? Math.min(1000, Math.round(saved.step)) : 1
  const presets = parsePresets((saved.presets || []).join(','))
  const countdownStart = Number.isFinite(saved.countdownStart) && saved.countdownStart > 0 ? Math.min(3600, Math.round(saved.countdownStart)) : 30
  return {
    ...base,
    teams: teams && teams.length ? teams : base.teams,
    step,
    presets,
    countdownStart,
    countdown: Number.isFinite(saved.countdown) ? Math.max(0, Math.min(3600, Math.round(saved.countdown))) : countdownStart,
    countdownRunning: false, // a timer can't survive a restart
    triviaQuestion: String(saved.triviaQuestion || ''),
    triviaAnswer: String(saved.triviaAnswer || ''),
    mode: ['scores', 'trivia', 'countdown'].includes(saved.mode) ? saved.mode : 'scores'
  }
}

/** "10, 20 45" → [10, 20, 45]: positive whole seconds, unique, sorted, at most 8; the defaults if nothing usable. */
export function parsePresets(text) {
  const nums = [...new Set(String(text || '').split(/[\s,;]+/).map((s) => Math.round(Number(s))).filter((n) => Number.isFinite(n) && n > 0 && n <= 3600))]
    .sort((a, b) => a - b)
    .slice(0, 8)
  return nums.length ? nums : [...DEFAULT_PRESETS]
}

export function addTeam(game) {
  if (game.teams.length >= MAX_TEAMS) return game
  return { ...game, teams: [...game.teams, team(game.teams.length)] }
}

export function removeTeam(game, id) {
  if (game.teams.length <= 1) return game
  return { ...game, teams: game.teams.filter((t) => t.id !== id) }
}

export function bumpScore(game, id, direction) {
  return { ...game, teams: game.teams.map((t) => (t.id === id ? { ...t, score: Math.max(0, t.score + direction * game.step) } : t)) }
}

export const resetScores = (game) => ({ ...game, teams: game.teams.map((t) => ({ ...t, score: 0 })) })

export const scoresText = (game) => game.teams.map((t) => `${t.name}: ${t.score}`).join('\n')
