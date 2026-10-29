// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

let renderAudienceState

beforeAll(() => {
  const src = fs.readFileSync(path.join(__dirname, '../public/output/audience-render.js'), 'utf8')
  const sandbox = { document, module: { exports: {} }, console }
  vm.createContext(sandbox)
  vm.runInContext(src, sandbox)
  renderAudienceState = sandbox.renderAudienceState
})

const makeRoot = () => document.createElement('div')
const VIDEO = { type: 'video', src: 'file:///C:/v/loop.mp4' }
const PICTURE = { type: 'image', src: 'data:image/png;base64,AAAA' }

describe('renderAudienceState: the media layer', () => {
  it('shows a picture behind the slide text and over the slide background', () => {
    const root = makeRoot()
    renderAudienceState({ showLogo: false, slide: { text: 'Hello', background: { type: 'color', color: '#ff0000' } }, media: PICTURE }, root, 1)
    expect(root.style.background).toContain('data:image/png')
    expect(root.textContent).toContain('Hello')
  })

  it('shows a looping muted video, with or without a slide', () => {
    const withSlide = makeRoot()
    renderAudienceState({ showLogo: false, slide: { text: 'Hello' }, media: VIDEO }, withSlide, 1)
    const video = withSlide.querySelector('#output-bg-video')
    expect(video.getAttribute('src')).toBe(VIDEO.src)
    expect(video.loop).toBe(true)
    expect(video.muted).toBe(true)
    const alone = makeRoot()
    renderAudienceState({ showLogo: false, slide: null, media: VIDEO }, alone, 1)
    expect(alone.querySelector('#output-bg-video')).not.toBeNull()
  })

  it('the logo still covers it, and no darkening layer is laid over it', () => {
    const logo = makeRoot()
    renderAudienceState({ showLogo: true, slide: { text: 'x' }, media: VIDEO }, logo, 1)
    expect(logo.querySelector('#output-bg-video')).toBeNull()
    const dimmed = makeRoot()
    renderAudienceState({ showLogo: false, slide: { text: 'x' }, dim: 40, media: PICTURE }, dimmed, 1)
    expect(dimmed.querySelector('#output-dim')).toBeNull()
  })

  it('takes the video away again once the media layer is cleared', () => {
    const root = makeRoot()
    renderAudienceState({ showLogo: false, slide: { text: 'x' }, media: VIDEO }, root, 1)
    renderAudienceState({ showLogo: false, slide: { text: 'x' }, media: null }, root, 1)
    expect(root.querySelector('#output-bg-video')).toBeNull()
  })
})
