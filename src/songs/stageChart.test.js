import { describe, it, expect } from 'vitest'
import { buildStageChart } from './stageChart.js'

const slide = (id, label, group, text, chords = []) => ({ id, label, group, text, linesData: [{ text, chords }] })

describe('buildStageChart', () => {
  const pres = {
    id: 'p',
    key: 'C',
    slides: [
      slide('a', 'Verse 1', 'verse', 'Morning light', [{ pos: 0, chord: 'C' }, { pos: 8, chord: 'G' }]),
      slide('b', 'Verse 1', 'verse', 'Over the hill', [{ pos: 0, chord: 'F' }]),
      slide('c', 'Chorus', 'chorus', 'Sing it out', [{ pos: 0, chord: 'Am' }])
    ]
  }

  it('lists every slide in order with its chords inline', () => {
    const chart = buildStageChart(pres)
    expect(chart.map((s) => s.label)).toEqual(['Verse 1', 'Verse 1 (cont.)', 'Chorus'])
    expect(chart[0].text).toBe('[C]Morning [G]light')
  })

  it('follows the key the singer asked for', () => {
    const chart = buildStageChart({ ...pres, transpose: 2 })
    expect(chart[0].text).toBe('[D]Morning [A]light')
  })

  it('follows the active arrangement, repeats included', () => {
    const chart = buildStageChart({
      ...pres,
      arrangements: [{ id: 'x', name: 'Live', sequence: ['a', 'c', 'c'] }],
      activeArrangementId: 'x'
    })
    expect(chart.map((s) => s.text)).toEqual(['[C]Morning [G]light', '[Am]Sing it out', '[Am]Sing it out'])
  })

  it('returns nothing without a presentation', () => {
    expect(buildStageChart(null)).toEqual([])
  })
})
