import { describe, it, expect } from 'vitest'
import { BUILTIN_BACKGROUNDS } from './builtinBackgrounds.js'

describe('BUILTIN_BACKGROUNDS', () => {
  it('ships a gallery of at least 8 backgrounds with unique ids', () => {
    expect(BUILTIN_BACKGROUNDS.length).toBeGreaterThanOrEqual(8)
    const ids = BUILTIN_BACKGROUNDS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every background has a display name and an SVG data URL', () => {
    for (const bg of BUILTIN_BACKGROUNDS) {
      expect(bg.name, bg.id).toBeTruthy()
      expect(bg.dataUrl, bg.id).toMatch(/^data:image\/svg\+xml;utf8,/)
    }
  })

  it('data URLs are safe inside unquoted CSS url() — no bare parens or quotes', () => {
    for (const bg of BUILTIN_BACKGROUNDS) {
      const payload = bg.dataUrl.slice('data:image/svg+xml;utf8,'.length)
      expect(payload, bg.id).not.toMatch(/[()'"]/)
    }
  })

  it('every background decodes to valid SVG sized to the 1920×1080 design space', () => {
    for (const bg of BUILTIN_BACKGROUNDS) {
      const svg = decodeURIComponent(bg.dataUrl.slice('data:image/svg+xml;utf8,'.length))
      expect(svg, bg.id).toMatch(/^<svg /)
      expect(svg, bg.id).toContain('viewBox="0 0 1920 1080"')
      expect(svg, bg.id).toContain('</svg>')
    }
  })

  it('stays lightweight — under 4 KB per background', () => {
    for (const bg of BUILTIN_BACKGROUNDS) {
      expect(bg.dataUrl.length, bg.id).toBeLessThan(4096)
    }
  })
})
