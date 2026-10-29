import { describe, it, expect, afterEach } from 'vitest'
import {
  isFontFileName,
  familyFromFileName,
  cleanUserFonts,
  addUserFont,
  removeUserFont,
  fontFaceCss,
  registerUserFonts,
  usedFamilies,
  fontsForPayload,
  readFontFile,
  FONT_STYLE_ID
} from './fontStore.js'

const DATA = 'data:font/ttf;base64,AAAA'

afterEach(() => {
  document.head.innerHTML = ''
})

describe('file names', () => {
  it('accepts only font files', () => {
    expect(['a.ttf', 'a.OTF', 'a.woff', 'a.woff2'].every(isFontFileName)).toBe(true)
    expect(isFontFileName('a.png')).toBe(false)
    expect(isFontFileName('')).toBe(false)
  })

  it('makes a family name from the file name', () => {
    expect(familyFromFileName('Playfair-Display_Bold.ttf')).toBe('Playfair Display')
    expect(familyFromFileName('OpenSans-Regular.otf')).toBe('Open Sans')
    expect(familyFromFileName('Lobster.woff2')).toBe('Lobster')
    expect(familyFromFileName('.ttf')).toBe('Custom font')
  })
})

describe('the font list', () => {
  it('drops malformed entries and repeated names', () => {
    const list = cleanUserFonts([
      { family: 'A', dataUrl: DATA },
      { family: 'a', dataUrl: DATA },
      { family: 'B', dataUrl: 'http://evil/x.ttf' },
      { family: '', dataUrl: DATA },
      null
    ])
    expect(list.map((f) => f.family)).toEqual(['A'])
    expect(cleanUserFonts('nope')).toEqual([])
  })

  it('adding a font with the same name replaces it; removing works by id', () => {
    let list = addUserFont([], { family: 'Lobster', dataUrl: DATA })
    list = addUserFont(list, { family: 'Lobster', dataUrl: 'data:font/otf;base64,BBBB' })
    expect(list).toHaveLength(1)
    expect(list[0].dataUrl).toContain('BBBB')
    expect(removeUserFont(list, list[0].id)).toEqual([])
  })
})

describe('registering', () => {
  it('writes @font-face rules and escapes the family name', () => {
    const css = fontFaceCss([{ family: 'My "Font"', dataUrl: DATA }])
    expect(css).toContain('font-family:"My \\"Font\\""')
    expect(css).toContain(`src:url("${DATA}")`)
  })

  it('keeps a single style element in the page and removes it when there are no fonts', () => {
    registerUserFonts([{ family: 'A', dataUrl: DATA }])
    registerUserFonts([{ family: 'A', dataUrl: DATA }, { family: 'B', dataUrl: DATA }])
    expect(document.querySelectorAll(`#${FONT_STYLE_ID}`)).toHaveLength(1)
    expect(document.getElementById(FONT_STYLE_ID).textContent).toContain('"B"')
    registerUserFonts([])
    expect(document.getElementById(FONT_STYLE_ID)).toBeNull()
  })
})

describe('what the audience screen needs', () => {
  const slide = {
    style: { fontFamily: 'Plain' },
    elements: [{ fontFamily: 'Lobster', runs: [{ fontFamily: 'Pacifico' }] }]
  }
  const fonts = [
    { family: 'Lobster', dataUrl: DATA },
    { family: 'Pacifico', dataUrl: DATA },
    { family: 'Unused', dataUrl: DATA }
  ]

  it('finds every family the slide, its runs and the theme use', () => {
    expect([...usedFamilies(slide, { fontFamily: "Theme Font, 'Serif Two'" })].sort()).toEqual(['lobster', 'pacifico', 'plain', 'serif two', 'theme font'])
  })

  it('sends only the used user fonts, or null', () => {
    expect(fontsForPayload(fonts, slide, null).map((f) => f.family)).toEqual(['Lobster', 'Pacifico'])
    expect(fontsForPayload(fonts, { style: { fontFamily: 'Inter' } }, null)).toBeNull()
    expect(fontsForPayload([], slide, null)).toBeNull()
  })
})

describe('readFontFile', () => {
  it('reads a font file into a family and a data URL with the right type', async () => {
    const file = new window.File([new Uint8Array([1, 2, 3])], 'Playfair-Display_Bold.ttf')
    const out = await readFontFile(file)
    expect(out.family).toBe('Playfair Display')
    expect(out.dataUrl.startsWith('data:font/ttf;base64,')).toBe(true)
  })

  it('refuses other files and oversize files with a readable message', async () => {
    await expect(readFontFile(new window.File(['x'], 'photo.png'))).rejects.toThrow(/\.ttf/)
    const big = new window.File(['x'], 'big.ttf')
    Object.defineProperty(big, 'size', { value: 9 * 1024 * 1024 })
    await expect(readFontFile(big)).rejects.toThrow(/8 MB/)
  })
})
