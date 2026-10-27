import { describe, it, expect } from 'vitest'
import { parseChordProToSlides } from './chordpro.js'

describe('parseChordProToSlides — section headers', () => {
  it('starts a new slide at bracketed headers and uses them as group/label', () => {
    const slides = parseChordProToSlides('[Verse 1]\nline one\n[Chorus]\nline two')
    expect(slides).toHaveLength(2)
    expect(slides[0].group).toBe('verse')
    expect(slides[0].label).toBe('Verse 1')
    expect(slides[0].text).toBe('line one')
    expect(slides[1].group).toBe('chorus')
    expect(slides[1].label).toBe('Chorus')
    expect(slides[1].text).toBe('line two')
  })

  it('recognizes colon-style headers like "Verse 1:"', () => {
    const slides = parseChordProToSlides('Verse 1:\nfirst line')
    expect(slides).toHaveLength(1)
    expect(slides[0].group).toBe('verse')
    expect(slides[0].text).toBe('first line')
  })

  it('is case-insensitive for section names', () => {
    const slides = parseChordProToSlides('[chorus]\nsome line')
    expect(slides[0].group).toBe('chorus')
  })

  it('supports all documented section types', () => {
    const sections = ['Verse', 'Chorus', 'Bridge', 'Pre-Chorus', 'Intro', 'Outro', 'Tag']
    for (const s of sections) {
      const slides = parseChordProToSlides(`[${s}]\nlyric`)
      expect(slides[0].group).toBe(s.toLowerCase())
    }
  })

  it('uses default group/label when no header is given', () => {
    const slides = parseChordProToSlides('just a line')
    expect(slides[0].group).toBe('verse')
    expect(slides[0].label).toBe('Verse 1')
  })
})

describe('parseChordProToSlides — bare Indonesian headings', () => {
  const text = ['Bait 1', 'Satu dua tiga', '', 'Reff:', 'Empat lima enam', '', 'Bait 2:', 'Tujuh delapan'].join('\n')

  it('recognises Bait / Reff written without brackets, with the right groups and labels', () => {
    const slides = parseChordProToSlides(text)
    expect(slides.map((s) => [s.group, s.label])).toEqual([
      ['verse', 'Bait 1'],
      ['chorus', 'Reff'],
      ['verse', 'Bait 2']
    ])
    expect(slides.map((s) => s.text)).toEqual(['Satu dua tiga', 'Empat lima enam', 'Tujuh delapan'])
  })

  it('does not mistake a lyric line that merely starts with the word for a heading', () => {
    const slides = parseChordProToSlides(['[Verse 1]', 'Bait yang indah bagi kita'].join('\n'))
    expect(slides).toHaveLength(1)
    expect(slides[0].text).toBe('Bait yang indah bagi kita')
  })
})

describe('parseChordProToSlides — slide splitting', () => {
  it('splits slides on blank lines within a section', () => {
    const slides = parseChordProToSlides('[Verse 1]\nline a\nline b\n\nline c')
    expect(slides).toHaveLength(2)
    expect(slides[0].text).toBe('line a\nline b')
    expect(slides[1].text).toBe('line c')
  })

  it('auto-splits when a slide reaches maxLines', () => {
    const input = '[Verse 1]\n1\n2\n3\n4\n5'
    const slides = parseChordProToSlides(input, 2)
    expect(slides.map((s) => s.text)).toEqual(['1\n2', '3\n4', '5'])
  })

  it('defaults to 4 max lines per slide', () => {
    const input = '[Verse 1]\n1\n2\n3\n4\n5\n6\n7\n8\n9'
    const slides = parseChordProToSlides(input)
    expect(slides.map((s) => s.text)).toEqual(['1\n2\n3\n4', '5\n6\n7\n8', '9'])
  })

  it('handles CRLF line endings', () => {
    const slides = parseChordProToSlides('[Verse 1]\r\nline a\r\nline b')
    expect(slides).toHaveLength(1)
    expect(slides[0].text).toBe('line a\nline b')
  })

  it('commits the trailing slide at end of input', () => {
    const slides = parseChordProToSlides('lonely last line')
    expect(slides).toHaveLength(1)
    expect(slides[0].text).toBe('lonely last line')
  })

  it('returns no slides for empty or whitespace-only input', () => {
    expect(parseChordProToSlides('')).toHaveLength(0)
    expect(parseChordProToSlides('\n\n  \n')).toHaveLength(0)
  })

  it('does not emit empty slides for consecutive blank lines', () => {
    const slides = parseChordProToSlides('line a\n\n\n\nline b')
    expect(slides).toHaveLength(2)
  })

  it('gives every slide a unique id', () => {
    const slides = parseChordProToSlides('[Verse 1]\na\n\nb\n\nc')
    const ids = new Set(slides.map((s) => s.id))
    expect(ids.size).toBe(slides.length)
  })
})

describe('parseChordProToSlides — chord extraction', () => {
  it('strips chords from the display text', () => {
    const slides = parseChordProToSlides('[C]Amazing [F]grace')
    expect(slides[0].text).toBe('Amazing grace')
  })

  it('records chord positions relative to the clean text', () => {
    const slides = parseChordProToSlides('[C]Amazing [F]grace')
    expect(slides[0].linesData[0].chords).toEqual([
      { pos: 0, chord: 'C' },
      { pos: 8, chord: 'F' }
    ])
  })

  it('handles chords mid-word', () => {
    const slides = parseChordProToSlides('Ama[G7]zing')
    expect(slides[0].text).toBe('Amazing')
    expect(slides[0].linesData[0].chords).toEqual([{ pos: 3, chord: 'G7' }])
  })

  it('produces empty chord arrays for chord-free lines', () => {
    const slides = parseChordProToSlides('no chords here')
    expect(slides[0].linesData[0].chords).toEqual([])
  })

  it('keeps one linesData entry per line', () => {
    const slides = parseChordProToSlides('[C]line one\nline [D]two')
    expect(slides[0].linesData).toHaveLength(2)
    expect(slides[0].linesData[0].text).toBe('line one')
    expect(slides[0].linesData[1].text).toBe('line two')
  })
})
