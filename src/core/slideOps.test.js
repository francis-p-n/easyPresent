import { describe, it, expect } from 'vitest'
import { canRemoveSlide, removeSlide, indexAfterRemoval } from './slideOps.js'
import { getActiveSequence } from './arrangement.js'

const song = (extra = {}) => ({
  id: 'p',
  name: 'Song',
  slides: [
    { id: 'intro', label: 'Intro', text: '' },
    { id: 'v1', label: 'Verse 1', text: 'One' },
    { id: 'ch', label: 'Chorus', text: 'Two' }
  ],
  ...extra
})

describe('removeSlide', () => {
  it('takes one slide out and leaves the original alone', () => {
    const original = song()
    const next = removeSlide(original, 'intro')
    expect(next.slides.map((s) => s.id)).toEqual(['v1', 'ch'])
    expect(original.slides).toHaveLength(3)
    expect(next.name).toBe('Song')
  })

  it('does nothing for a slide that is not there', () => {
    const original = song()
    expect(removeSlide(original, 'nope')).toBe(original)
    expect(removeSlide(null, 'x')).toBeNull()
  })

  it('takes it out of every arrangement too', () => {
    const pres = song({
      arrangements: [
        { id: 'a1', name: 'Short', sequence: ['intro', 'v1', 'ch', 'ch'] },
        { id: 'a2', name: 'Other', sequence: ['v1', 'ch'] }
      ],
      activeArrangementId: 'a1'
    })
    const next = removeSlide(pres, 'ch')
    expect(next.arrangements[0].sequence).toEqual(['intro', 'v1'])
    expect(next.arrangements[1].sequence).toEqual(['v1'])
    expect(getActiveSequence(next).map((s) => s.id)).toEqual(['intro', 'v1'])
  })

  it('an arrangement left empty falls back to Master', () => {
    const pres = song({ arrangements: [{ id: 'a1', name: 'Only intro', sequence: ['intro'] }], activeArrangementId: 'a1' })
    const next = removeSlide(pres, 'intro')
    expect(next.activeArrangementId).toBeUndefined()
    expect(getActiveSequence(next).map((s) => s.id)).toEqual(['v1', 'ch'])
  })
})

describe('canRemoveSlide', () => {
  it('keeps at least one slide', () => {
    expect(canRemoveSlide(song())).toBe(true)
    expect(canRemoveSlide({ slides: [{ id: 'a' }] })).toBe(false)
    expect(canRemoveSlide(null)).toBe(false)
  })
})

describe('indexAfterRemoval', () => {
  it('moves later positions up and marks the removed one', () => {
    expect(indexAfterRemoval(3, 1)).toBe(2)
    expect(indexAfterRemoval(0, 1)).toBe(0)
    expect(indexAfterRemoval(1, 1)).toBe(-1)
    expect(indexAfterRemoval(-1, 1)).toBe(-1)
    expect(indexAfterRemoval(undefined, 1)).toBeUndefined()
  })
})
