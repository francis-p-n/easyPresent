import { describe, it, expect } from 'vitest'
import { isSvgDataUrl, rasterSize, rasterizeIfSvg } from './svgRaster.js'

const SVG = 'data:image/svg+xml;base64,PHN2Zy8+'

const fakeCanvas = (calls) => () => ({
  width: 0,
  height: 0,
  getContext: () => ({ drawImage: (...a) => calls.push(a) }),
  toDataURL: function () {
    calls.push(['size', this.width, this.height])
    return 'data:image/png;base64,AAAA'
  }
})

describe('isSvgDataUrl', () => {
  it('recognises SVG data URLs only', () => {
    expect(isSvgDataUrl(SVG)).toBe(true)
    expect(isSvgDataUrl('DATA:IMAGE/SVG+XML;utf8,<svg/>')).toBe(true)
    expect(isSvgDataUrl('data:image/png;base64,AAAA')).toBe(false)
    expect(isSvgDataUrl(null)).toBe(false)
  })
})

describe('rasterSize', () => {
  it('fits the SVG inside the screen keeping its shape', () => {
    expect(rasterSize(400, 400)).toEqual({ width: 1080, height: 1080 })
    expect(rasterSize(3840, 2160)).toEqual({ width: 1920, height: 1080 })
  })
  it('uses a 16:9 canvas for an SVG with no size of its own', () => {
    expect(rasterSize(0, 0)).toEqual({ width: 1920, height: 1080 })
  })
})

describe('rasterizeIfSvg', () => {
  it('draws the SVG to a canvas and returns a PNG', async () => {
    const calls = []
    const out = await rasterizeIfSvg(SVG, { load: async () => ({ naturalWidth: 400, naturalHeight: 200 }), makeCanvas: fakeCanvas(calls) })
    expect(out).toBe('data:image/png;base64,AAAA')
    expect(calls.find((c) => c[0] === 'size')).toEqual(['size', 1920, 960])
    expect(calls[0][3]).toBe(1920)
  })

  it('returns anything that is not an SVG unchanged', async () => {
    const png = 'data:image/png;base64,AAAA'
    expect(await rasterizeIfSvg(png)).toBe(png)
  })

  it('falls back to the original when the SVG cannot be loaded or drawn', async () => {
    expect(await rasterizeIfSvg(SVG, { load: async () => { throw new Error('bad') } })).toBe(SVG)
    expect(await rasterizeIfSvg(SVG, { load: async () => ({ naturalWidth: 10, naturalHeight: 10 }), makeCanvas: () => ({ getContext: () => null }) })).toBe(SVG)
  })
})
