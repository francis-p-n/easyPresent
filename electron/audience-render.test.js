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

describe('renderAudienceState — cleared/logo states', () => {
  it('renders a black empty screen when state is null', () => {
    const root = makeRoot()
    renderAudienceState(null, root, 1)
    expect(root.children).toHaveLength(0)
    expect(root.style.background).toBe('rgb(0, 0, 0)')
  })

  it('shows the logo (not the slide) when showLogo is true, even with a live slide', () => {
    const root = makeRoot()
    renderAudienceState({ showLogo: true, slide: { text: 'should not show' } }, root, 1)
    expect(root.textContent).not.toContain('should not show')
    expect(root.querySelector('#output-logo')).not.toBeNull() // visible mark, so it never looks like a dead projector
    expect(root.textContent).toContain('EasyPresent')
  })

  it('renders black when there is no slide', () => {
    const root = makeRoot()
    renderAudienceState({ showLogo: false, slide: null }, root, 1)
    expect(root.children).toHaveLength(0)
  })
})

describe('renderAudienceState — slide text', () => {
  it('renders slide text with theme defaults when no per-slide style is given', () => {
    const root = makeRoot()
    renderAudienceState(
      { slide: { text: 'Hello world', style: null }, themeStyles: { fontSize: '64px', color: '#ffffff' } },
      root,
      1
    )
    const box = root.querySelector('#output-text')
    expect(box.textContent).toBe('Hello world')
    expect(box.style.color).toBe('rgb(255, 255, 255)')
  })

  it('per-slide style overrides theme defaults', () => {
    const root = makeRoot()
    renderAudienceState(
      {
        slide: { text: 'Styled', style: { fontSize: 84, color: '#ff0000', hAlign: 'left' } },
        themeStyles: { fontSize: '48px', color: '#ffffff', textAlign: 'center' }
      },
      root,
      1
    )
    const box = root.querySelector('#output-text')
    expect(box.style.fontSize).toBe('84px')
    expect(box.style.color).toBe('rgb(255, 0, 0)')
    expect(box.style.textAlign).toBe('left')
  })

  it('scales font size by the provided scale factor', () => {
    const root = makeRoot()
    renderAudienceState({ slide: { text: 'x', style: { fontSize: 100 } } }, root, 0.5)
    expect(root.querySelector('#output-text').style.fontSize).toBe('50px')
  })

  it('renders a media background behind the text', () => {
    const root = makeRoot()
    renderAudienceState(
      { slide: { text: 'x', background: { type: 'media', mediaPath: 'file:///bg.png' } } },
      root,
      1
    )
    expect(root.style.background).toContain('file:///bg.png')
  })

  it('renders a color background', () => {
    const root = makeRoot()
    renderAudienceState({ slide: { text: 'x', background: { type: 'color', color: '#123456' } } }, root, 1)
    expect(root.style.background).toBe('rgb(18, 52, 86)')
  })

  it('does not render a text box when slide text is empty', () => {
    const root = makeRoot()
    renderAudienceState({ slide: { text: '' } }, root, 1)
    expect(root.querySelector('#output-text')).toBeNull()
  })
})

describe('renderAudienceState — message overlay', () => {
  it('renders the message pill alongside slide text', () => {
    const root = makeRoot()
    renderAudienceState({ slide: { text: 'Slide' }, message: 'Please silence your phones' }, root, 1)
    expect(root.querySelector('#output-text')).not.toBeNull()
    expect(root.querySelector('#output-message').textContent).toBe('Please silence your phones')
  })

  it('renders the message even with no live slide', () => {
    const root = makeRoot()
    renderAudienceState({ slide: null, message: 'Standalone' }, root, 1)
    expect(root.querySelector('#output-message').textContent).toBe('Standalone')
  })

  it('omits the message element when there is no message', () => {
    const root = makeRoot()
    renderAudienceState({ slide: { text: 'x' }, message: null }, root, 1)
    expect(root.querySelector('#output-message')).toBeNull()
  })
})

describe('renderAudienceState — re-render clears previous frame', () => {
  it('clears prior DOM content on each call (no stacking)', () => {
    const root = makeRoot()
    renderAudienceState({ slide: { text: 'first' } }, root, 1)
    renderAudienceState({ slide: { text: 'second' } }, root, 1)
    expect(root.querySelectorAll('#output-text')).toHaveLength(1)
    expect(root.querySelector('#output-text').textContent).toBe('second')
  })
})

describe('renderAudienceState — hide-slide look', () => {
  it('keeps slide text off the screen but still shows the message', () => {
    const root = makeRoot()
    renderAudienceState({ hideSlide: true, slide: { text: 'lyrics' }, message: 'Welcome' }, root, 1)
    expect(root.textContent).not.toContain('lyrics')
    expect(root.textContent).toContain('Welcome')
    expect(root.querySelector('#output-logo')).toBeNull()
  })
})

describe('transitionAudience', () => {
  let transitionAudience
  beforeAll(() => {
    const src = fs.readFileSync(path.join(__dirname, '../public/output/audience-render.js'), 'utf8')
    const sandbox = { document, module: { exports: {} }, console, setTimeout }
    vm.createContext(sandbox)
    vm.runInContext(src, sandbox)
    transitionAudience = sandbox.transitionAudience
  })

  it('cuts straight to the new frame when the type is cut', () => {
    const root = makeRoot()
    transitionAudience({ slide: { text: 'A' } }, root, 1, { type: 'cut', ms: 400 })
    transitionAudience({ slide: { text: 'B' } }, root, 1, { type: 'cut', ms: 400 })
    expect(root.querySelector('.output-transition-old')).toBeNull()
    expect(root.textContent).toBe('B')
  })

  it('does not transition from an empty screen', () => {
    const root = makeRoot()
    transitionAudience({ slide: { text: 'A' } }, root, 1, { type: 'dissolve', ms: 400 })
    expect(root.querySelector('.output-transition-old')).toBeNull()
  })

  it('overlays the previous frame during a dissolve, then removes it', async () => {
    const root = makeRoot()
    transitionAudience({ slide: { text: 'A' } }, root, 1, { type: 'cut', ms: 0 })
    transitionAudience({ slide: { text: 'B' } }, root, 1, { type: 'dissolve', ms: 20 })
    const old = root.querySelector('.output-transition-old')
    expect(old).not.toBeNull()
    expect(old.textContent).toBe('A')
    expect(root.querySelector('#output-text').textContent).toBe('B')
    await new Promise((r) => setTimeout(r, 120))
    expect(root.querySelector('.output-transition-old')).toBeNull()
  })

  it('a new frame mid-transition drops the stale overlay (no stacking)', () => {
    const root = makeRoot()
    transitionAudience({ slide: { text: 'A' } }, root, 1, { type: 'cut', ms: 0 })
    transitionAudience({ slide: { text: 'B' } }, root, 1, { type: 'wipe', ms: 5000 })
    transitionAudience({ slide: { text: 'C' } }, root, 1, { type: 'wipe', ms: 5000 })
    expect(root.querySelectorAll('.output-transition-old')).toHaveLength(1)
    expect(root.querySelector('.output-transition-old').textContent).toBe('B')
  })
})

describe('renderAudienceState — screens that are not 16:9', () => {
  const layoutState = { slide: { text: 'x', elements: [{ x: 0, y: 0, width: 960, height: 540, text: 'Box', fontSize: 40 }] } }

  it('fits and centres a positioned layout on a 4:3 screen instead of stretching it', () => {
    const root = makeRoot()
    renderAudienceState(layoutState, root, 0.5, { w: 1024, h: 768 })
    const page = root.querySelector('#output-page')
    expect(page).not.toBeNull()
    expect(page.style.width).toBe('1024px') // fit = 1024/1920 → page spans the full width
    expect(page.style.height).toBe('576px')
    expect(page.style.top).toBe('96px') // letterboxed: (768 - 576) / 2
    expect(page.textContent).toBe('Box')
  })

  it('without a viewport it behaves as before (no page wrapper)', () => {
    const root = makeRoot()
    renderAudienceState(layoutState, root, 1)
    expect(root.querySelector('#output-page')).toBeNull()
  })
})

describe('renderAudienceState — per-run styling from a PPTX import', () => {
  const state = (runs) => ({
    slide: { text: 'x', elements: [{ x: 0, y: 0, width: 960, height: 540, text: 'Praise the Lord always', fontSize: 40, runs }] }
  })

  it('styles just the bold word and the red word', () => {
    const root = makeRoot()
    renderAudienceState(
      state([
        { start: 7, end: 10, bold: true },
        { start: 16, end: 22, color: '#ff0000', fontSize: 80 }
      ]),
      root,
      0.5
    )
    const spans = [...root.querySelectorAll('span')]
    expect(spans.map((s) => s.textContent)).toEqual(['the', 'always'])
    expect(spans[0].style.fontWeight).toBe('700')
    expect(spans[1].style.color).toBe('rgb(255, 0, 0)')
    expect(spans[1].style.fontSize).toBe('40px') // 80 * scale 0.5
    expect(root.textContent).toBe('Praise the Lord always')
  })

  it('ignores ranges that are out of bounds or overlap, and shows plain text without runs', () => {
    const root = makeRoot()
    renderAudienceState(state([{ start: 99, end: 120, bold: true }, { start: 7, end: 10, bold: true }, { start: 8, end: 12, italic: true }]), root, 1)
    expect(root.textContent).toBe('Praise the Lord always')
    expect(root.querySelectorAll('span')).toHaveLength(1)
    const plain = makeRoot()
    renderAudienceState(state(undefined), plain, 1)
    expect(plain.querySelectorAll('span')).toHaveLength(0)
  })
})

describe('renderAudienceState — added fonts', () => {
  it('registers the fonts sent with the slide, once', () => {
    document.head.innerHTML = ''
    const root = makeRoot()
    const state = { slide: { text: 'Hi', style: { fontFamily: 'Lobster' } }, fonts: [{ family: 'Lobster', dataUrl: 'data:font/ttf;base64,AAAA' }] }
    renderAudienceState(state, root, 1)
    renderAudienceState(state, root, 1)
    const styles = document.head.querySelectorAll('#ep-audience-fonts')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toBe('@font-face{font-family:"Lobster";src:url("data:font/ttf;base64,AAAA");}')
  })

  it('cannot be broken out of by a hostile font name', () => {
    document.head.innerHTML = ''
    renderAudienceState({ slide: { text: 'x' }, fonts: [{ family: 'A"};body{display:none}/*', dataUrl: 'data:font/ttf;base64,AAAA' }] }, makeRoot(), 1)
    expect(document.getElementById('ep-audience-fonts').textContent).not.toContain('"};')
  })
})

describe('renderAudienceState — video backgrounds', () => {
  window.HTMLMediaElement.prototype.play = () => Promise.resolve() // jsdom has no media playback
  const videoState = { slide: { text: 'Hi', background: { type: 'video', mediaPath: 'file:///C:/loop.mp4', color: '#101010' } } }

  it('plays a muted looping video behind the text', () => {
    const root = makeRoot()
    renderAudienceState(videoState, root, 1)
    const video = root.querySelector('#output-bg-video')
    expect(video).not.toBeNull()
    expect(video.getAttribute('src')).toBe('file:///C:/loop.mp4')
    expect(video.muted && video.loop).toBe(true)
    expect(root.firstChild).toBe(video)
    expect(root.textContent).toBe('Hi')
  })

  it('keeps the same element when the next slide uses the same video, so the loop does not restart', () => {
    const root = makeRoot()
    renderAudienceState(videoState, root, 1)
    const first = root.querySelector('#output-bg-video')
    renderAudienceState({ slide: { text: 'Next', background: videoState.slide.background } }, root, 1)
    expect(root.querySelector('#output-bg-video')).toBe(first)
    expect(root.textContent).toBe('Next')
  })

  it('drops the video when the next slide has another background', () => {
    const root = makeRoot()
    renderAudienceState(videoState, root, 1)
    renderAudienceState({ slide: { text: 'Plain', background: { type: 'color', color: '#222' } } }, root, 1)
    expect(root.querySelector('video')).toBeNull()
  })
})
