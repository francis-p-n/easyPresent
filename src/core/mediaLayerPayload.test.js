import { describe, it, expect } from 'vitest'
import { buildOutputPayload, payloadSignature } from './outputSync.js'

const slide = { active: true, content: { text: 'Hi' } }
const media = (content) => ({ slide, media: { active: true, content } })

describe('the media layer in the output payload', () => {
  it('carries a picture or video for the audience screen', () => {
    const p = buildOutputPayload(media({ id: 'm', type: 'video', src: 'file:///C:/v/loop.mp4' }), null, false, '')
    expect(p.media).toEqual({ type: 'video', src: 'file:///C:/v/loop.mp4' })
    expect(buildOutputPayload(media({ id: 'm', type: 'image', src: 'data:image/png;base64,AA' }), null, false, '').media.type).toBe('image')
  })

  it('has no media when the layer is off or empty', () => {
    expect(buildOutputPayload({ slide, media: { active: false, content: null } }, null, false, '').media).toBeNull()
    expect(buildOutputPayload({ slide }, null, false, '').media).toBeNull()
    expect(buildOutputPayload(media({ id: 'm', type: 'image' }), null, false, '').media).toBeNull()
  })

  it('a change of media shows in the signature', () => {
    const a = payloadSignature(buildOutputPayload(media({ type: 'image', src: 'data:image/png;base64,AA' }), null, false, ''))
    const b = payloadSignature(buildOutputPayload({ slide }, null, false, ''))
    const c = payloadSignature(buildOutputPayload(media({ type: 'video', src: 'file:///C:/v/loop.mp4' }), null, false, ''))
    expect(new Set([a, b, c]).size).toBe(3)
  })
})
