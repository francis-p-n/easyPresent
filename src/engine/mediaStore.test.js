import { describe, it, expect } from 'vitest'
import { dehydrate, rehydrate, MEDIA_REF_PREFIX, MEDIA_MIN_LENGTH } from './mediaStore.js'

const bigUrl = (seed, len = MEDIA_MIN_LENGTH + 100) => 'data:image/jpeg;base64,' + seed.repeat(len)

describe('mediaStore — dehydrate/rehydrate', () => {
  it('lifts a large data URL into the dictionary and leaves a reference', () => {
    const url = bigUrl('a')
    const { value, media } = dehydrate({ bg: url })
    expect(value.bg.startsWith(MEDIA_REF_PREFIX)).toBe(true)
    expect(Object.values(media)).toEqual([url])
  })

  it('stores a repeated image exactly once', () => {
    const url = bigUrl('a')
    const slides = Array.from({ length: 10 }, () => ({ background: { mediaPath: url } }))
    const { value, media } = dehydrate({ slides })
    expect(Object.keys(media)).toHaveLength(1)
    const refs = new Set(value.slides.map((s) => s.background.mediaPath))
    expect(refs.size).toBe(1)
  })

  it('keeps distinct images distinct', () => {
    const { media } = dehydrate([{ a: bigUrl('a') }, { b: bigUrl('b') }, { c: bigUrl('a') }])
    expect(Object.keys(media)).toHaveLength(2)
  })

  it('leaves short strings and non-data strings alone', () => {
    const input = { text: 'Amazing grace', tiny: 'data:image/gif;base64,R0lGOD', n: 5, ok: true, nil: null }
    const { value, media } = dehydrate(input)
    expect(value).toEqual(input)
    expect(media).toEqual({})
  })

  it('round-trips a nested structure exactly', () => {
    const url = bigUrl('x')
    const other = bigUrl('y')
    const lib = {
      presentations: [
        {
          id: 'p1',
          name: 'Deck',
          slides: [
            { id: 's1', text: 'one', background: { type: 'media', mediaPath: url } },
            { id: 's2', text: 'two', background: { type: 'media', mediaPath: url }, images: [{ mediaPath: other }] }
          ],
          arrangements: [{ id: 'a', sequence: ['s1', 's2'] }]
        }
      ],
      playlists: [{ id: 'pl', items: [{ type: 'presentation', id: 'p1' }] }],
      themes: [{ id: 'default', styles: { color: '#fff' } }]
    }
    const { value, media } = dehydrate(lib)
    // survives an actual JSON trip, which is how it's really used
    const restored = rehydrate(JSON.parse(JSON.stringify(value)), JSON.parse(JSON.stringify(media)))
    expect(restored).toEqual(lib)
  })

  it('shares one string instance across every slide that used the image', () => {
    const url = bigUrl('a')
    const { value, media } = dehydrate({ s: [{ p: url }, { p: url }, { p: url }] })
    const r = rehydrate(value, media)
    expect(r.s[0].p).toBe(r.s[1].p)
    expect(r.s[1].p).toBe(r.s[2].p)
  })

  it('passes v1 data (no media dictionary) through untouched', () => {
    const v1 = { presentations: [{ slides: [{ background: { mediaPath: bigUrl('a') } }] }] }
    expect(rehydrate(v1, undefined)).toEqual(v1)
    expect(rehydrate(v1, null)).toEqual(v1)
  })

  it('leaves a dangling reference visible rather than silently blanking it', () => {
    const out = rehydrate({ bg: MEDIA_REF_PREFIX + 'missing' }, { m0: 'data:whatever' })
    expect(out.bg).toBe(MEDIA_REF_PREFIX + 'missing')
  })

  it('does not mistake ordinary slide text for a reference', () => {
    const text = 'ep-media: the sequel'
    expect(rehydrate({ text }, { m0: 'data:x' }).text).toBe(text)
  })

  it('actually shrinks a realistic repeated-background deck', () => {
    const url = bigUrl('a', 4000)
    const deck = { slides: Array.from({ length: 10 }, (_, i) => ({ id: 's' + i, background: { mediaPath: url } })) }
    const before = JSON.stringify(deck).length
    const { value, media } = dehydrate(deck)
    const after = JSON.stringify({ ...value, media }).length
    expect(after).toBeLessThan(before / 5)
  })
})
