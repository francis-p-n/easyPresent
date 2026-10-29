import { describe, it, expect, afterEach } from 'vitest'
import { normalizeLook, isEmptyLook, applyLook, placeDim, MAX_DIM } from './serviceLook.js'
import { buildOutputPayload, payloadSignature } from './outputSync.js'
import { normalizeMeta, carryForwardMeta } from './services.js'

const IMG = 'data:image/png;base64,AAAA'
const live = (content) => ({ slide: { active: true, content }, message: { active: false } })
const theme = { styles: { fontFamily: 'Inter', fontSize: '64px', color: '#ffffff', backgroundColor: '#000000' } }

afterEach(() => {
  document.body.innerHTML = ''
})

describe('normalizeLook', () => {
  it('is empty by default and drops junk', () => {
    expect(isEmptyLook(undefined)).toBe(true)
    expect(isEmptyLook({ dim: 50 })).toBe(true) // darkening nothing changes nothing
    const l = normalizeLook({ background: { type: 'media', mediaPath: IMG }, dim: 500, textColor: 'red', fontFamily: '  Lobster ', fontSize: 9999 })
    expect(l.dim).toBe(MAX_DIM)
    expect(l.textColor).toBe('')
    expect(l.fontFamily).toBe('Lobster')
    expect(l.fontSize).toBe(300)
    expect(normalizeLook({ background: { type: 'media', mediaPath: '' } }).background).toBeNull()
    expect(normalizeLook({ background: { type: 'color', color: '#112233' } }).background).toEqual({ type: 'color', color: '#112233' })
  })
})

describe('applyLook', () => {
  const look = { background: { type: 'media', mediaPath: IMG }, dim: 40, textColor: '#112233', fontSize: 90 }

  it('gives a slide with no background of its own the service background, darkened, with the text style', () => {
    const r = applyLook(look, theme.styles, undefined)
    expect(r.background.mediaPath).toBe(IMG)
    expect(r.dim).toBe(40)
    expect(r.themeStyles).toMatchObject({ color: '#112233', fontSize: '90px', fontFamily: 'Inter' })
    expect(theme.styles.color).toBe('#ffffff') // the theme itself is untouched
  })

  it('lets a slide keep its own background, with no darkening over it', () => {
    const own = { type: 'color', color: '#ff0000' }
    const r = applyLook(look, theme.styles, own)
    expect(r.background).toBe(own)
    expect(r.dim).toBe(0)
  })

  it('does nothing without a look', () => {
    const r = applyLook(null, theme.styles, undefined)
    expect(r.background).toBeNull()
    expect(r.dim).toBe(0)
    expect(r.themeStyles).toEqual(theme.styles)
    expect(applyLook(null, null, null).themeStyles).toBeNull()
  })
})

describe('the output payload', () => {
  const look = { background: { type: 'media', mediaPath: IMG }, dim: 30, fontFamily: 'Lobster' }

  it('carries the look to the audience screen', () => {
    const p = buildOutputPayload(live({ text: 'Hi' }), theme, false, '', { look })
    expect(p.slide.background.mediaPath).toBe(IMG)
    expect(p.dim).toBe(30)
    expect(p.themeStyles.fontFamily).toBe('Lobster')
  })

  it('leaves a slide with its own background alone', () => {
    const p = buildOutputPayload(live({ text: 'Hi', background: { type: 'color', color: '#ff0000' } }), theme, false, '', { look })
    expect(p.slide.background.color).toBe('#ff0000')
    expect(p.dim).toBe(0)
  })

  it('without a look the payload is what it always was', () => {
    const p = buildOutputPayload(live({ text: 'Hi' }), theme, false, '')
    expect(p.slide.background).toBeNull()
    expect(p.themeStyles).toEqual(theme.styles)
    expect(p.dim).toBe(0)
  })

  it('a change of darkening changes the signature', () => {
    const a = payloadSignature(buildOutputPayload(live({ text: 'Hi' }), theme, false, '', { look }))
    const b = payloadSignature(buildOutputPayload(live({ text: 'Hi' }), theme, false, '', { look: { ...look, dim: 50 } }))
    expect(a).not.toBe(b)
  })
})

describe('placeDim', () => {
  it('sits above a background video and below the content, and goes away at 0', () => {
    const host = document.createElement('div')
    const video = document.createElement('video')
    host.appendChild(video)
    document.body.appendChild(host)
    placeDim(host, 40, 'd')
    expect(host.children[1].id).toBe('d')
    expect(host.children[1].style.background).toContain('0.4')
    placeDim(host, 60, 'd')
    expect(host.querySelectorAll('#d')).toHaveLength(1)
    placeDim(host, 0, 'd')
    expect(host.querySelector('#d')).toBeNull()
  })
})

describe('in the service details', () => {
  it('is kept when a service is saved and carried to next week', () => {
    const meta = normalizeMeta({ date: '2026-11-01', look: { background: { type: 'media', mediaPath: IMG }, dim: 20 } })
    expect(meta.look.dim).toBe(20)
    expect(carryForwardMeta(meta).look.background.mediaPath).toBe(IMG)
    expect(normalizeMeta({ date: '2026-11-01' }).look).toBeUndefined()
  })
})
