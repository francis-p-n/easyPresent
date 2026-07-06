import { describe, it, expect } from 'vitest'
import { buildOutputPayload, payloadSignature } from './outputSync.js'

const theme = { styles: { fontFamily: 'Inter', fontSize: '64px', color: '#fff', textAlign: 'center' } }

describe('buildOutputPayload', () => {
  it('returns a null slide when the slide layer is inactive', () => {
    const layers = { slide: { active: false, content: { text: 'hidden' } }, message: { active: false, content: null } }
    const payload = buildOutputPayload(layers, theme, false, '00:00')
    expect(payload.slide).toBeNull()
  })

  it('carries text, style, and background when the slide is live', () => {
    const layers = {
      slide: {
        active: true,
        content: {
          text: 'Amazing grace',
          style: { fontSize: 84, bold: true },
          background: { type: 'color', color: '#111111' }
        }
      },
      message: { active: false, content: null }
    }
    const payload = buildOutputPayload(layers, theme, false, '00:00')
    expect(payload.slide).toEqual({
      text: 'Amazing grace',
      style: { fontSize: 84, bold: true },
      background: { type: 'color', color: '#111111' }
    })
  })

  it('defaults style/background to null when the slide omits them', () => {
    const layers = { slide: { active: true, content: { text: 'x' } }, message: { active: false, content: null } }
    const payload = buildOutputPayload(layers, theme, false, '00:00')
    expect(payload.slide.style).toBeNull()
    expect(payload.slide.background).toBeNull()
  })

  it('substitutes {timer} in the message', () => {
    const layers = {
      slide: { active: false, content: null },
      message: { active: true, content: 'Starting in {timer}' }
    }
    const payload = buildOutputPayload(layers, theme, false, '05:00')
    expect(payload.message).toBe('Starting in 05:00')
  })

  it('is null when the message layer is inactive', () => {
    const layers = { slide: { active: false, content: null }, message: { active: false, content: 'ignored' } }
    const payload = buildOutputPayload(layers, theme, false, '00:00')
    expect(payload.message).toBeNull()
  })

  it('passes through showLogo as a boolean', () => {
    const layers = { slide: { active: false, content: null }, message: { active: false, content: null } }
    expect(buildOutputPayload(layers, theme, true, '00:00').showLogo).toBe(true)
    expect(buildOutputPayload(layers, theme, undefined, '00:00').showLogo).toBe(false)
  })

  it('handles missing layers/theme without throwing', () => {
    expect(() => buildOutputPayload(null, null, false, null)).not.toThrow()
    const payload = buildOutputPayload(null, null, false, null)
    expect(payload.slide).toBeNull()
    expect(payload.message).toBeNull()
    expect(payload.themeStyles).toBeNull()
  })
})

describe('payloadSignature', () => {
  it('is stable for equivalent payloads', () => {
    const a = buildOutputPayload(
      { slide: { active: true, content: { text: 'x', background: { type: 'color', color: '#000' } } }, message: { active: false, content: null } },
      theme, false, '00:00'
    )
    const b = buildOutputPayload(
      { slide: { active: true, content: { text: 'x', background: { type: 'color', color: '#000' } } }, message: { active: false, content: null } },
      theme, false, '00:00'
    )
    expect(payloadSignature(a)).toBe(payloadSignature(b))
  })

  it('changes when slide text changes', () => {
    const base = { slide: { active: true, content: { text: 'a' } }, message: { active: false, content: null } }
    const changed = { slide: { active: true, content: { text: 'b' } }, message: { active: false, content: null } }
    const sigA = payloadSignature(buildOutputPayload(base, theme, false, '00:00'))
    const sigB = payloadSignature(buildOutputPayload(changed, theme, false, '00:00'))
    expect(sigA).not.toBe(sigB)
  })

  it('changes when per-slide style changes even if text is identical', () => {
    const base = { slide: { active: true, content: { text: 'same', style: { fontSize: 48 } } }, message: { active: false, content: null } }
    const changed = { slide: { active: true, content: { text: 'same', style: { fontSize: 96 } } }, message: { active: false, content: null } }
    const sigA = payloadSignature(buildOutputPayload(base, theme, false, '00:00'))
    const sigB = payloadSignature(buildOutputPayload(changed, theme, false, '00:00'))
    expect(sigA).not.toBe(sigB)
  })

  it('represents large media backgrounds by length, not full content', () => {
    const bigDataUrl = 'data:image/png;base64,' + 'A'.repeat(5_000_000)
    const layers = {
      slide: { active: true, content: { text: 'x', background: { type: 'media', mediaPath: bigDataUrl } } },
      message: { active: false, content: null }
    }
    const sig = payloadSignature(buildOutputPayload(layers, theme, false, '00:00'))
    expect(sig.length).toBeLessThan(1000) // signature stays cheap regardless of background size
  })

  it('distinguishes different background media without hashing full content', () => {
    const a = { type: 'media', mediaPath: 'data:image/png;base64,' + 'A'.repeat(100) }
    const b = { type: 'media', mediaPath: 'data:image/png;base64,' + 'B'.repeat(200) }
    const sigA = payloadSignature(buildOutputPayload({ slide: { active: true, content: { text: 'x', background: a } }, message: { active: false, content: null } }, theme, false, '00:00'))
    const sigB = payloadSignature(buildOutputPayload({ slide: { active: true, content: { text: 'x', background: b } }, message: { active: false, content: null } }, theme, false, '00:00'))
    expect(sigA).not.toBe(sigB)
  })

  it('changes when the message changes independent of the slide', () => {
    const base = { slide: { active: false, content: null }, message: { active: true, content: 'one' } }
    const changed = { slide: { active: false, content: null }, message: { active: true, content: 'two' } }
    const sigA = payloadSignature(buildOutputPayload(base, theme, false, '00:00'))
    const sigB = payloadSignature(buildOutputPayload(changed, theme, false, '00:00'))
    expect(sigA).not.toBe(sigB)
  })
})
