import { describe, it, expect, beforeEach } from 'vitest'
import { state } from '../../engine/StateManager.js'
import { renderChordSheet } from './ChordSheet.js'

let container

beforeEach(() => {
  container = document.createElement('div')
})

describe('renderChordSheet', () => {
  it('renders nothing without a selected presentation', () => {
    state.set('selectedPresentation', null)
    renderChordSheet(container)
    expect(container.children).toHaveLength(0)
  })

  it('aligns chords above their lyric positions with padding', () => {
    state.set('selectedPresentation', {
      id: 'p',
      slides: [
        {
          label: 'Verse 1',
          text: 'Amazing grace',
          linesData: [
            {
              text: 'Amazing grace',
              chords: [
                { pos: 0, chord: 'C' },
                { pos: 8, chord: 'F' }
              ]
            }
          ]
        }
      ]
    })
    renderChordSheet(container)

    // The chord row is the div ChordSheet styles with pre whitespace + bold
    const chordLine = [...container.querySelectorAll('div')].find(
      (d) => d.style.whiteSpace === 'pre' && d.style.fontWeight === 'bold'
    )
    // 'C' at column 0, then spaces to column 8 for 'F'
    expect(chordLine.textContent).toBe('C       F')
  })

  it('falls back to plain slide text when no linesData exists', () => {
    state.set('selectedPresentation', {
      id: 'p',
      slides: [{ label: 'V1', text: 'Plain lyrics only' }]
    })
    renderChordSheet(container)
    expect(container.textContent).toContain('Plain lyrics only')
  })

  it('renders the slide label as a heading', () => {
    state.set('selectedPresentation', {
      id: 'p',
      slides: [{ label: 'Bridge', text: 'x' }]
    })
    renderChordSheet(container)
    expect(container.textContent).toContain('Bridge')
  })
})
