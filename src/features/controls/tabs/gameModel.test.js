import { describe, it, expect } from 'vitest'
import {
  defaultGame,
  normalizeGame,
  parsePresets,
  addTeam,
  removeTeam,
  bumpScore,
  resetScores,
  scoresText,
  MAX_TEAMS
} from './gameModel.js'

describe('gameModel', () => {
  it('starts with two teams and sensible defaults', () => {
    const g = defaultGame()
    expect(g.teams.map((t) => t.name)).toEqual(['Team A', 'Team B'])
    expect(g.step).toBe(1)
    expect(g.presets).toEqual([10, 15, 30, 60])
  })

  it('adds teams up to the cap and never below one', () => {
    let g = defaultGame()
    for (let i = 0; i < 20; i++) g = addTeam(g)
    expect(g.teams).toHaveLength(MAX_TEAMS)
    expect(new Set(g.teams.map((t) => t.id)).size).toBe(MAX_TEAMS)
    for (let i = 0; i < 20; i++) g = removeTeam(g, g.teams[0].id)
    expect(g.teams).toHaveLength(1)
  })

  it('scores by the configured step and never goes below zero', () => {
    let g = { ...defaultGame(), step: 5 }
    const id = g.teams[0].id
    g = bumpScore(g, id, +1)
    g = bumpScore(g, id, +1)
    expect(g.teams[0].score).toBe(10)
    g = bumpScore(g, id, -1)
    g = bumpScore(g, id, -1)
    g = bumpScore(g, id, -1)
    expect(g.teams[0].score).toBe(0)
    expect(g.teams[1].score).toBe(0)
  })

  it('resets all scores and renders them as text', () => {
    let g = defaultGame()
    g = bumpScore(g, g.teams[1].id, +1)
    expect(scoresText(g)).toBe('Team A: 0\nTeam B: 1')
    expect(scoresText(resetScores(g))).toBe('Team A: 0\nTeam B: 0')
  })

  it('does not mutate the game it is given', () => {
    const g = defaultGame()
    bumpScore(g, g.teams[0].id, +1)
    addTeam(g)
    expect(g.teams).toHaveLength(2)
    expect(g.teams[0].score).toBe(0)
  })

  it('migrates the old teamA/teamB/teamC shape, keeping names, scores and the active count', () => {
    const g = normalizeGame({
      teamA: { name: 'Lions', score: 4, color: '#ef4444' },
      teamB: { name: 'Bears', score: 2, color: '#3b82f6' },
      teamC: { name: 'Owls', score: 9, color: '#22c55e' },
      activeTeams: 2,
      countdown: 12
    })
    expect(g.teams.map((t) => [t.name, t.score])).toEqual([['Lions', 4], ['Bears', 2]])
    expect(g.countdown).toBe(12)
  })

  it('survives junk input', () => {
    for (const junk of [null, undefined, 'x', 5, {}, { teams: 'no' }, { teams: [] }]) {
      expect(normalizeGame(junk).teams.length).toBeGreaterThan(0)
    }
    const g = normalizeGame({ teams: [{ name: 5, score: 'x', color: 'red' }], step: -3, presets: ['a'], mode: 'zzz', countdownRunning: true })
    expect(g.teams[0].score).toBe(0)
    expect(g.teams[0].color).toMatch(/^#/)
    expect(g.step).toBe(1)
    expect(g.presets).toEqual([10, 15, 30, 60])
    expect(g.mode).toBe('scores')
    expect(g.countdownRunning).toBe(false)
  })

  it('parses countdown shortcuts leniently', () => {
    expect(parsePresets('45, 20 90;5')).toEqual([5, 20, 45, 90])
    expect(parsePresets('20, 20, 20')).toEqual([20])
    expect(parsePresets('nope, -4, 0')).toEqual([10, 15, 30, 60])
    expect(parsePresets('1,2,3,4,5,6,7,8,9,10')).toHaveLength(8)
  })
})
