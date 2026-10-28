import { describe, it, expect } from 'vitest'
import { themeFor, livePresentation, presentationTransition } from './presentationDefaults.js'
import { resolveTransition, buildOutputPayload } from './outputSync.js'

const themes = [{ id: 'default', styles: { color: '#fff' } }, { id: 'sermon', styles: { color: '#fc0' } }]

describe('themeFor', () => {
  it('uses the presentation theme when it names one that exists', () => {
    expect(themeFor({ themeId: 'sermon' }, themes, 'default').id).toBe('sermon')
  })
  it('falls back to the active theme, then the first, then null', () => {
    expect(themeFor({}, themes, 'sermon').id).toBe('sermon')
    expect(themeFor({ themeId: 'deleted' }, themes, 'sermon').id).toBe('sermon')
    expect(themeFor(null, themes, 'missing').id).toBe('default')
    expect(themeFor({}, [], 'x')).toBeNull()
    expect(themeFor({}, undefined, 'x')).toBeNull()
  })
})

describe('livePresentation', () => {
  it('prefers the live one over the selected one', () => {
    const a = { id: 'a' }
    const b = { id: 'b' }
    expect(livePresentation([a, b], 'a', b)).toBe(a)
    expect(livePresentation([a, b], 'zzz', b)).toBe(b)
    expect(livePresentation(undefined, null, null)).toBeNull()
  })
})

describe('presentationTransition', () => {
  it('accepts only known values', () => {
    expect(presentationTransition({ transition: 'wipe' })).toBe('wipe')
    expect(presentationTransition({ transition: 'spin' })).toBeUndefined()
    expect(presentationTransition(null)).toBeUndefined()
  })
})

describe('transition precedence: slide > presentation > app', () => {
  it('uses each level only when the more specific ones are silent', () => {
    expect(resolveTransition({ transition: 'wipe' }, 'cut', 400, 'dissolve').type).toBe('wipe')
    expect(resolveTransition({}, 'cut', 400, 'dissolve').type).toBe('dissolve')
    expect(resolveTransition({}, 'wipe', 400, undefined).type).toBe('wipe')
    expect(resolveTransition({}, 'cut', 400, 'bogus').type).toBe('cut')
  })

  it('reaches the audience payload', () => {
    const layers = { slide: { active: true, content: { text: 'x' } }, message: { active: false, content: null } }
    const p = buildOutputPayload(layers, null, false, '', { transition: 'cut', transitionMs: 300, presentationTransition: 'dissolve' })
    expect(p.transition).toEqual({ type: 'dissolve', ms: 300 })
  })
})
