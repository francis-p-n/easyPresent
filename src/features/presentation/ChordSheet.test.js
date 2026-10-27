import { describe, it, expect, beforeEach } from 'vitest'
import { state } from '../../core/StateManager.js'
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

  it('puts each chord on top of the words it precedes', () => {
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

    // Two columns, each a chord over its own words - alignment does not depend on padded spaces
    const columns = [...container.querySelectorAll('div')].filter((d) => d.children.length === 2 && d.style.flexDirection === 'column')
    expect(columns.map((c) => [c.children[0].textContent, c.children[1].textContent])).toEqual([
      ['C', 'Amazing '],
      ['F', 'grace']
    ])
  })

  it('keeps a chord over its own syllable in wide scripts', () => {
    state.set('selectedPresentation', {
      id: 'p',
      slides: [{ label: 'V', text: 'x', linesData: [{ text: '你好ab', chords: [{ pos: 2, chord: 'G' }] }] }]
    })
    renderChordSheet(container)
    const columns = [...container.querySelectorAll('div')].filter((d) => d.children.length === 2 && d.style.flexDirection === 'column')
    expect(columns.map((c) => [c.children[0].textContent.trim(), c.children[1].textContent])).toEqual([
      ['', '你好'],
      ['G', 'ab']
    ])
  })

  it('labels a slide that carries on a section "(cont.)"', () => {
    state.set('selectedPresentation', {
      id: 'p',
      slides: [
        { label: 'Verse 1', group: 'verse', text: 'a' },
        { label: 'Verse 1', group: 'verse', text: 'b' },
        { label: 'Chorus', group: 'chorus', text: 'c' }
      ]
    })
    renderChordSheet(container)
    const labels = [...container.querySelectorAll('div')].filter((d) => d.style.fontWeight === 'bold' && d.children.length === 0).map((d) => d.textContent)
    expect(labels).toEqual(['Verse 1', 'Verse 1 (cont.)', 'Chorus'])
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
