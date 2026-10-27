import { describe, it, expect } from 'vitest'
import { lineSegments, sectionLabel, markContinuations, continuesSection } from './chordLayout.js'

describe('lineSegments', () => {
  it('pairs each chord with the words it precedes', () => {
    const segs = lineSegments({ text: 'Amazing grace', chords: [{ pos: 0, chord: 'C' }, { pos: 8, chord: 'F' }] })
    expect(segs).toEqual([
      { chord: 'C', text: 'Amazing ' },
      { chord: 'F', text: 'grace' }
    ])
  })

  it('keeps words that come before the first chord, with no chord over them', () => {
    expect(lineSegments({ text: 'Oh Lord', chords: [{ pos: 3, chord: 'G' }] })).toEqual([
      { chord: '', text: 'Oh ' },
      { chord: 'G', text: 'Lord' }
    ])
  })

  it('returns the whole line when it has no chords', () => {
    expect(lineSegments({ text: 'just words', chords: [] })).toEqual([{ chord: '', text: 'just words' }])
    expect(lineSegments({ text: 'just words' })).toEqual([{ chord: '', text: 'just words' }])
  })

  it('gives each chord of an instrumental line a segment with no words', () => {
    // positions run past the (empty) text: the chords are spaced out, there is nothing to sit over
    expect(lineSegments({ text: '', chords: [{ pos: 0, chord: 'G' }, { pos: 2, chord: 'D' }, { pos: 4, chord: 'Em' }] })).toEqual([
      { chord: 'G', text: '' },
      { chord: 'D', text: '' },
      { chord: 'Em', text: '' }
    ])
  })

  it('does not depend on how wide a character is drawn', () => {
    const segs = lineSegments({ text: '你好ab', chords: [{ pos: 2, chord: 'G' }] })
    expect(segs).toEqual([
      { chord: '', text: '你好' },
      { chord: 'G', text: 'ab' }
    ])
  })

  it('sorts chords that were stored out of order, and can change them on the way (transposing)', () => {
    const segs = lineSegments({ text: 'ab cd', chords: [{ pos: 3, chord: 'C' }, { pos: 0, chord: 'G' }] }, (c) => c + '!')
    expect(segs).toEqual([
      { chord: 'G!', text: 'ab ' },
      { chord: 'C!', text: 'cd' }
    ])
  })
})

describe('section labels', () => {
  const s = (label, group = 'verse') => ({ label, group })

  it('flags a slide that carries on the section above, but not a different section or the first slide', () => {
    const slides = markContinuations([s('Verse 1'), s('Verse 1'), s('Chorus', 'chorus'), s('Verse 1')])
    expect(slides.map((x) => x.cont)).toEqual([false, true, false, false])
  })

  it('does not treat unlabelled slides as continuations', () => {
    expect(markContinuations([{ text: 'a' }, { text: 'b' }]).map((x) => x.cont)).toEqual([false, false])
  })

  it('reads the heading with "(cont.)" only for a continuation', () => {
    expect(sectionLabel({ label: 'Verse 1', cont: true })).toBe('Verse 1 (cont.)')
    expect(sectionLabel({ label: 'Verse 1', cont: false })).toBe('Verse 1')
    expect(sectionLabel({ cont: true })).toBe('')
  })

  it('works out continuation from the slides themselves, so an edited label is never mistaken', () => {
    const slides = [s('Verse 1'), s('Verse 1')]
    expect(continuesSection(slides, 1)).toBe(true)
    slides[1].label = 'Bridge'
    expect(continuesSection(slides, 1)).toBe(false)
  })
})
