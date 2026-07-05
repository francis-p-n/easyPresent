// @vitest-environment node
// The stage display is a plain <script> (not a module), so we execute it in
// a VM sandbox with stubbed io/document and pull its functions off the
// sandbox global.
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

let sandbox

beforeAll(() => {
  const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8')

  const stubEl = () => ({
    appendChild() {},
    addEventListener() {},
    set innerHTML(_) {},
    style: {},
    textContent: '',
    className: ''
  })

  sandbox = {
    io: () => ({ on() {} }),
    document: {
      getElementById: () => stubEl(),
      createElement: () => stubEl(),
      addEventListener() {}
    },
    window: {},
    console
  }
  vm.createContext(sandbox)
  vm.runInContext(src, sandbox)
})

describe('stage display — transposeChord', () => {
  const t = (chord, steps) => sandbox.transposeChord(chord, steps)

  it('transposes natural roots up and down', () => {
    expect(t('C', 2)).toBe('D')
    expect(t('G', -2)).toBe('F')
  })

  it('preserves chord suffixes', () => {
    expect(t('Cmaj7', 2)).toBe('Dmaj7')
    expect(t('Am7', 3)).toBe('Cm7')
  })

  it('handles sharps and stays in the sharp family', () => {
    expect(t('C#m7', 1)).toBe('Dm7')
    expect(t('F#', 1)).toBe('G')
  })

  it('handles flats and stays in the flat family', () => {
    expect(t('Bb', 2)).toBe('C')
    expect(t('Eb', -1)).toBe('D')
  })

  it('wraps around the octave in both directions', () => {
    expect(t('B', 1)).toBe('C')
    expect(t('C', -1)).toBe('B')
  })

  it('returns zero-step and unparseable input unchanged', () => {
    expect(t('C', 0)).toBe('C')
    expect(t('xyz', 3)).toBe('xyz')
    expect(t('', 3)).toBe('')
  })
})

describe('stage display — renderSlide protocol', () => {
  it('registers a slide-update socket handler on load', () => {
    // Re-run with a recording io stub
    const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8')
    const handlers = {}
    const ctx = {
      io: () => ({ on: (evt, cb) => (handlers[evt] = cb) }),
      document: sandbox.document,
      window: {},
      console
    }
    vm.createContext(ctx)
    vm.runInContext(src, ctx)
    expect(typeof handlers['slide-update']).toBe('function')
    // Text-only payloads (the slim broadcast shape) must not throw
    expect(() => handlers['slide-update']({ text: 'Hello [C]world' })).not.toThrow()
    expect(() => handlers['slide-update'](null)).not.toThrow()
  })
})
