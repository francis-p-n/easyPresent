import { describe, it, expect } from 'vitest'
import {
  eventToSpec,
  describeSpec,
  sanitizeOverrides,
  effectiveBindings,
  buildLookup,
  bindKey,
  resetAction,
  loadOverrides,
  saveOverrides,
  SHORTCUTS_KEY
} from './shortcuts.js'

const memory = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }
}

describe('eventToSpec', () => {
  it('lower-cases single characters and ignores Shift on them', () => {
    expect(eventToSpec({ key: 'B', shiftKey: true })).toBe('b')
    expect(eventToSpec({ key: '?', shiftKey: true })).toBe('?')
  })
  it('prefixes Shift on named keys only', () => {
    expect(eventToSpec({ key: 'ArrowRight', shiftKey: true })).toBe('Shift+ArrowRight')
    expect(eventToSpec({ key: 'ArrowRight', shiftKey: false })).toBe('ArrowRight')
    expect(eventToSpec({ key: ' ' })).toBe(' ')
  })
  it('gives nothing for a bare modifier or junk', () => {
    for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'Dead', '', undefined]) expect(eventToSpec({ key })).toBeNull()
    expect(eventToSpec(null)).toBeNull()
  })
})

describe('describeSpec', () => {
  it('reads naturally', () => {
    expect(describeSpec(' ')).toBe('Space')
    expect(describeSpec('Shift+ArrowRight')).toBe('Shift + →')
    expect(describeSpec('b')).toBe('B')
    expect(describeSpec('F1')).toBe('F1')
  })
})

describe('default bindings', () => {
  it('match what the app has always done', () => {
    const l = buildLookup({})
    expect(l.get('ArrowRight')).toBe('next')
    expect(l.get(' ')).toBe('next')
    expect(l.get('Shift+ArrowRight')).toBe('nextSong')
    expect(l.get(']')).toBe('nextSong')
    expect(l.get('Escape')).toBe('clearAll')
    expect(l.get('b')).toBe('clearAll')
    expect(l.get('F6')).toBe('logo')
    expect(l.get('?')).toBe('help')
  })
})

describe('rebinding', () => {
  it('replaces an action keys with the new one, leaving the rest alone', () => {
    const o = bindKey({}, 'next', 'n')
    const l = buildLookup(o)
    expect(l.get('n')).toBe('next')
    expect(l.has('ArrowRight')).toBe(false)
    expect(l.get('ArrowLeft')).toBe('prev')
    expect(Object.keys(o)).toEqual(['next']) // only what changed is stored
  })

  it('appends instead of replacing', () => {
    const o = bindKey({}, 'logo', 'l', { append: true })
    expect(effectiveBindings(o).logo).toEqual(['F6', 'l'])
  })

  it('takes a key away from the action that had it', () => {
    const o = bindKey({}, 'logo', 'b') // b was Clear everything
    const b = effectiveBindings(o)
    expect(b.logo).toEqual(['b'])
    expect(b.clearAll).toEqual(['F1', '.', 'Escape'])
    expect(buildLookup(o).get('b')).toBe('logo')
  })

  it('can bind an action that has no default key', () => {
    const o = bindKey({}, 'hideAudienceText', 'h')
    expect(buildLookup(o).get('h')).toBe('hideAudienceText')
  })

  it('binding an action back to its defaults stores nothing', () => {
    expect(bindKey(bindKey({}, 'logo', 'l'), 'logo', 'F6')).toEqual({})
  })

  it('ignores unknown actions and empty keys', () => {
    expect(bindKey({}, 'launchMissiles', 'x')).toEqual({})
    expect(bindKey({}, 'next', '')).toEqual({})
  })

  it('reset restores one action to its defaults', () => {
    const o = bindKey({}, 'next', 'n')
    expect(effectiveBindings(resetAction(o, 'next')).next).toEqual(['ArrowRight', 'ArrowDown', 'PageDown', ' '])
  })

  it('does not mutate its input', () => {
    const o = { next: ['n'] }
    bindKey(o, 'prev', 'p')
    resetAction(o, 'next')
    expect(o).toEqual({ next: ['n'] })
  })
})

describe('saving', () => {
  it('round-trips through storage and survives junk', () => {
    const s = memory()
    saveOverrides({ next: ['n', 'n'], bogus: ['x'], prev: 'nope' }, s)
    expect(loadOverrides(s)).toEqual({ next: ['n'] })
    s.setItem(SHORTCUTS_KEY, '{not json')
    expect(loadOverrides(s)).toEqual({})
    expect(sanitizeOverrides(null)).toEqual({})
    expect(
      loadOverrides({
        getItem: () => {
          throw new Error('blocked')
        }
      })
    ).toEqual({})
  })
})
