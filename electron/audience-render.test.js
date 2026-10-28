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
