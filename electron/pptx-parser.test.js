// @vitest-environment node
// (pptx-parser runs in Electron's main process — Node, not jsdom. Under
// jsdom, Buffer is a polyfill that AdmZip's Buffer.isBuffer rejects, which
// silently writes empty zip entries in the fixture builder.)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import AdmZip from 'adm-zip'
import { parsePptx } from './pptx-parser.js'

// ---------------------------------------------------------------------------
// Fixture builder — constructs a minimal but structurally-real .pptx on disk
// ---------------------------------------------------------------------------

const PRESENTATION_XML = `<?xml version="1.0"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`
// 12192000 EMU = 13.333in wide → at a 1920px canvas, 1pt = 2px

const THEME_XML = `<?xml version="1.0"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="44546A"/></a:dk2>
      <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
      <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
      <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont><a:latin typeface="Playfair Display"/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/></a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`

function sld(inner) {
  return `<?xml version="1.0"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>${inner}</p:spTree></p:cSld>
</p:sld>`
}

// The "sear-ing loss" regression: one word split across three runs, then an
// explicit <a:br/>, then a second paragraph.
const SLIDE_RUNS = sld(`<p:sp><p:txBody>
  <a:bodyPr anchor="ctr"/>
  <a:p>
    <a:pPr algn="ctr"><a:lnSpc><a:spcPct val="150000"/></a:lnSpc></a:pPr>
    <a:r><a:rPr lang="en-US" sz="4200" b="1"><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:rPr><a:t>How great the pain of sear-</a:t></a:r>
    <a:r><a:rPr sz="4200" b="1" err="1"/><a:t>ing</a:t></a:r>
    <a:r><a:rPr sz="4200"/><a:t> loss.</a:t></a:r>
    <a:br/>
    <a:r><a:rPr sz="4200"/><a:t>The Father turns His face away</a:t></a:r>
  </a:p>
  <a:p><a:r><a:rPr sz="4200"/><a:t>Second paragraph</a:t></a:r></a:p>
</p:txBody></p:sp>`)

// Footer shape first in document order (short text, red), main body second
// (long text, dark gray, oversized). Style must come from the main body,
// entities must decode, and the huge size must clamp to 110.
const SLIDE_FOOTER_VS_BODY = sld(`
<p:sp><p:txBody>
  <a:bodyPr/>
  <a:p><a:r><a:rPr sz="1200"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:rPr><a:t>7</a:t></a:r></a:p>
</p:txBody></p:sp>
<p:sp><p:txBody>
  <a:bodyPr anchor="t"/>
  <a:p>
    <a:pPr algn="l"/>
    <a:r><a:rPr sz="9000" i="1"><a:solidFill><a:srgbClr val="343434"/></a:solidFill><a:latin typeface="+mj-lt"/></a:rPr><a:t>Peace &amp; joy &#8217;til dawn &lt;3 — the longest text on this slide</a:t></a:r>
  </a:p>
</p:txBody></p:sp>`)

const SLIDE_EMPTY = sld('')

const TINY_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

function buildPptx(filePath, { slides, theme = THEME_XML, presentation = PRESENTATION_XML, media = {}, rels = {} } = {}) {
  const zip = new AdmZip()
  if (presentation) zip.addFile('ppt/presentation.xml', Buffer.from(presentation))
  if (theme) zip.addFile('ppt/theme/theme1.xml', Buffer.from(theme))
  Object.entries(slides).forEach(([name, xml]) => zip.addFile(`ppt/slides/${name}`, Buffer.from(xml)))
  Object.entries(media).forEach(([name, buf]) => zip.addFile(`ppt/media/${name}`, buf))
  Object.entries(rels).forEach(([name, xml]) => zip.addFile(`ppt/slides/_rels/${name}`, Buffer.from(xml)))
  zip.writeZip(filePath)
  return filePath
}

let tmpDir

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-parser-test-'))
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Text extraction
// ---------------------------------------------------------------------------

describe('parsePptx — text extraction', () => {
  it('joins runs within a paragraph without inserting line breaks (sear-ing regression)', async () => {
    const file = buildPptx(path.join(tmpDir, 'runs.pptx'), { slides: { 'slide1.xml': SLIDE_RUNS } })
    const { slides } = await parsePptx(file)
    expect(slides[0].text).toBe(
      'How great the pain of sear-ing loss.\nThe Father turns His face away\nSecond paragraph'
    )
  })

  it('decodes XML entities in text', async () => {
    const file = buildPptx(path.join(tmpDir, 'entities.pptx'), { slides: { 'slide1.xml': SLIDE_FOOTER_VS_BODY } })
    const { slides } = await parsePptx(file)
    expect(slides[0].text).toContain("Peace & joy ’til dawn <3")
    expect(slides[0].text).not.toMatch(/&(amp|lt|gt|quot|apos|#\d+);/)
  })

  it('returns empty text (not a crash) for slides with no text shapes', async () => {
    const file = buildPptx(path.join(tmpDir, 'empty.pptx'), { slides: { 'slide1.xml': SLIDE_EMPTY } })
    const { slides } = await parsePptx(file)
    expect(slides[0].text).toBe('')
    expect(slides[0].style).toEqual({})
  })

  it('drops decorative empty paragraphs so lyrics don’t render with awkward blank-line gaps', async () => {
    // A worship slide authored with blank <a:p/> elements between visible
    // paragraphs — the classic "just press Enter for breathing room" pattern.
    const inner = sld(`<p:sp><p:txBody>
      <a:p><a:r><a:t>Amazing grace how sweet the sound</a:t></a:r></a:p>
      <a:p></a:p>
      <a:p></a:p>
      <a:p><a:r><a:t>That saved a wretch like me</a:t></a:r></a:p>
    </p:txBody></p:sp>`)
    const file = buildPptx(path.join(tmpDir, 'blanks.pptx'), { slides: { 'slide1.xml': inner } })
    const { slides } = await parsePptx(file)
    expect(slides[0].text).toBe(
      'Amazing grace how sweet the sound\nThat saved a wretch like me'
    )
  })

  it('orders slides numerically, not lexicographically', async () => {
    const file = buildPptx(path.join(tmpDir, 'order.pptx'), {
      slides: {
        'slide10.xml': sld('<p:sp><p:txBody><a:p><a:r><a:t>ten</a:t></a:r></a:p></p:txBody></p:sp>'),
        'slide2.xml': sld('<p:sp><p:txBody><a:p><a:r><a:t>two</a:t></a:r></a:p></p:txBody></p:sp>')
      }
    })
    const { slides } = await parsePptx(file)
    expect(slides.map((s) => s.text)).toEqual(['two', 'ten'])
  })
})

// ---------------------------------------------------------------------------
// Style extraction
// ---------------------------------------------------------------------------

describe('parsePptx — style extraction', () => {
  it('extracts size, weight, color, font, alignment, and line spacing', async () => {
    const file = buildPptx(path.join(tmpDir, 'style.pptx'), { slides: { 'slide1.xml': SLIDE_RUNS } })
    const { slides } = await parsePptx(file)
    expect(slides[0].style).toEqual({
      vAlign: 'center', // bodyPr anchor="ctr"
      fontSize: 84, // sz=4200 → 42pt × 2px/pt
      bold: true,
      color: '#FFFFFF', // schemeClr bg1 → theme lt1
      fontFamily: 'Calibri', // +mn-lt → theme minor font
      hAlign: 'center', // pPr algn="ctr"
      lineSpacing: 1.5 // lnSpc spcPct 150000
    })
  })

  it('takes the representative style from the shape with the most text, not document order', async () => {
    const file = buildPptx(path.join(tmpDir, 'mainbody.pptx'), { slides: { 'slide1.xml': SLIDE_FOOTER_VS_BODY } })
    const { slides } = await parsePptx(file)
    // Style must come from the long body (gray, italic, left), not the red footer
    expect(slides[0].style.color).toBe('#343434')
    expect(slides[0].style.italic).toBe(true)
    expect(slides[0].style.hAlign).toBe('left')
    expect(slides[0].style.vAlign).toBe('top')
    expect(slides[0].style.fontFamily).toBe('Playfair Display') // +mj-lt → theme major font
  })

  it('clamps oversized font sizes to the app template ceiling (110)', async () => {
    const file = buildPptx(path.join(tmpDir, 'clamp.pptx'), { slides: { 'slide1.xml': SLIDE_FOOTER_VS_BODY } })
    const { slides } = await parsePptx(file)
    // sz=9000 → 90pt × 2 = 180px raw → clamped
    expect(slides[0].style.fontSize).toBe(110)
  })

  it('omits color and font when the theme is missing, without crashing', async () => {
    const file = buildPptx(path.join(tmpDir, 'notheme.pptx'), {
      slides: { 'slide1.xml': SLIDE_RUNS },
      theme: null
    })
    const { slides } = await parsePptx(file)
    expect(slides[0].style.color).toBeUndefined() // schemeClr unresolvable
    expect(slides[0].style.fontFamily).toBeUndefined() // +mn-lt unresolvable
    expect(slides[0].style.fontSize).toBe(84) // sizes still work
  })

  it('falls back to the standard widescreen scale when presentation.xml is missing', async () => {
    const file = buildPptx(path.join(tmpDir, 'nopres.pptx'), {
      slides: { 'slide1.xml': SLIDE_RUNS },
      presentation: null
    })
    const { slides } = await parsePptx(file)
    expect(slides[0].style.fontSize).toBe(84) // fallback scale is also 2
  })

  it('only emits style keys the render engine understands', async () => {
    const RENDERER_VOCABULARY = new Set([
      'fontSize', 'fontFamily', 'color', 'bold', 'italic', 'underline',
      'hAlign', 'vAlign', 'lineSpacing'
    ])
    const file = buildPptx(path.join(tmpDir, 'vocab.pptx'), {
      slides: { 'slide1.xml': SLIDE_RUNS, 'slide2.xml': SLIDE_FOOTER_VS_BODY }
    })
    const { slides } = await parsePptx(file)
    for (const s of slides) {
      for (const key of Object.keys(s.style)) {
        expect(RENDERER_VOCABULARY.has(key), `unexpected style key: ${key}`).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Background extraction
// ---------------------------------------------------------------------------

// A slide-level picture-fill background (<p:bg>).
const SLIDE_BG_PICTURE = sld(`
  <p:bg><p:bgPr><a:blipFill><a:blip r:embed="rId1"/></a:blipFill></p:bgPr></p:bg>
  <p:sp><p:txBody><a:p><a:r><a:rPr sz="4200"/><a:t>Over a full background</a:t></a:r></a:p></p:txBody></p:sp>`)

// A shape filled with a picture that covers the whole slide → full-bleed bg.
const SLIDE_FULLBLEED_SHAPE = sld(`
  <p:pic>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm></p:spPr>
    <p:blipFill><a:blip r:embed="rId1"/></p:blipFill>
  </p:pic>
  <p:sp><p:txBody><a:p><a:r><a:rPr sz="4200"/><a:t>Title</a:t></a:r></a:p></p:txBody></p:sp>`)

// A small decorative picture in the corner → positioned image, NOT a background.
const SLIDE_CORNER_DECORATION = sld(`
  <p:pic>
    <p:spPr><a:xfrm><a:off x="10000000" y="5500000"/><a:ext cx="1000000" cy="800000"/></a:xfrm></p:spPr>
    <p:blipFill><a:blip r:embed="rId1"/></p:blipFill>
  </p:pic>
  <p:sp>
    <p:spPr><a:xfrm><a:off x="500000" y="500000"/><a:ext cx="6000000" cy="1000000"/></a:xfrm></p:spPr>
    <p:txBody><a:p><a:r><a:rPr sz="4200"/><a:t>Body text</a:t></a:r></a:p></p:txBody>
  </p:sp>`)

const IMAGE_REL = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`

describe('parsePptx — background images', () => {
  it('treats a <p:bg> picture fill as the full-bleed background', async () => {
    const file = buildPptx(path.join(tmpDir, 'bg.pptx'), {
      slides: { 'slide1.xml': SLIDE_BG_PICTURE },
      media: { 'image1.png': TINY_PNG },
      rels: { 'slide1.xml.rels': IMAGE_REL }
    })
    const { slides } = await parsePptx(file)
    expect(slides[0].background).toBe(`data:image/png;base64,${TINY_PNG.toString('base64')}`)
    expect(slides[0].bgImage).toBe(slides[0].background)
    expect(slides[0].images).toEqual([])
  })

  it('treats a whole-slide picture SHAPE as the full-bleed background', async () => {
    const file = buildPptx(path.join(tmpDir, 'fullbleed.pptx'), {
      slides: { 'slide1.xml': SLIDE_FULLBLEED_SHAPE },
      media: { 'image1.png': TINY_PNG },
      rels: { 'slide1.xml.rels': IMAGE_REL }
    })
    const { slides } = await parsePptx(file)
    expect(slides[0].background).toBe(`data:image/png;base64,${TINY_PNG.toString('base64')}`)
    expect(slides[0].images).toEqual([])
  })

  it('keeps a small corner picture as a POSITIONED image, not a background', async () => {
    const file = buildPptx(path.join(tmpDir, 'corner.pptx'), {
      slides: { 'slide1.xml': SLIDE_CORNER_DECORATION },
      media: { 'image1.png': TINY_PNG },
      rels: { 'slide1.xml.rels': IMAGE_REL }
    })
    const { slides } = await parsePptx(file)
    expect(slides[0].background).toBeNull()
    expect(slides[0].images).toHaveLength(1)
    // 10000000 EMU / 12192000 * 1920 ≈ 1575px x; positioned, not stretched
    expect(slides[0].images[0].x).toBeGreaterThan(1500)
    expect(slides[0].images[0].mediaPath).toBe(`data:image/png;base64,${TINY_PNG.toString('base64')}`)
    // A plain corner picture has no fillRect framing
    expect(slides[0].images[0].fill).toBeUndefined()
  })

  it('captures stretch fillRect insets so a zoomed/cropped decoration frames correctly', async () => {
    const cropped = sld(`
      <p:pic>
        <p:spPr><a:xfrm><a:off x="10000000" y="5500000"/><a:ext cx="1000000" cy="800000"/></a:xfrm></p:spPr>
        <p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect l="-626050" t="-72085" r="-90089" b="-501533"/></a:stretch></p:blipFill>
      </p:pic>`)
    const file = buildPptx(path.join(tmpDir, 'cropfill.pptx'), {
      slides: { 'slide1.xml': cropped },
      media: { 'image1.png': TINY_PNG },
      rels: { 'slide1.xml.rels': IMAGE_REL }
    })
    const { slides } = await parsePptx(file)
    expect(slides[0].images[0].fill).toEqual({ l: -626050, t: -72085, r: -90089, b: -501533 })
  })

  it('returns null background when the slide references no media', async () => {
    const file = buildPptx(path.join(tmpDir, 'nobg.pptx'), { slides: { 'slide1.xml': SLIDE_RUNS } })
    const { slides } = await parsePptx(file)
    expect(slides[0].background).toBeNull()
    expect(slides[0].bgImage).toBeNull()
    expect(slides[0].images).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Positioned layout (elements + list formatting)
// ---------------------------------------------------------------------------

// Two shapes with real geometry: a small title box and a body list box.
const SLIDE_LAYOUT = sld(`
  <p:sp>
    <p:spPr><a:xfrm><a:off x="1000000" y="500000"/><a:ext cx="4000000" cy="1000000"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr anchor="t"/><a:p><a:pPr algn="l"/><a:r><a:rPr sz="4800"><a:solidFill><a:srgbClr val="343434"/></a:solidFill></a:rPr><a:t>Title Here</a:t></a:r></a:p></p:txBody>
  </p:sp>
  <p:sp>
    <p:spPr><a:xfrm><a:off x="1000000" y="2000000"/><a:ext cx="9000000" cy="3000000"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr anchor="t"/>
      <a:p><a:pPr lvl="0" algn="l"><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:rPr sz="2400"/><a:t>First question</a:t></a:r></a:p>
      <a:p><a:pPr lvl="0" algn="l"><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:rPr sz="2400"/><a:t>Second question</a:t></a:r></a:p>
      <a:p><a:pPr lvl="1"><a:buChar char="&#8226;"/></a:pPr><a:r><a:rPr sz="2400"/><a:t>A sub point</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>`)

describe('parsePptx — positioned layout', () => {
  it('emits one positioned text element per shape with real geometry', async () => {
    const file = buildPptx(path.join(tmpDir, 'layout.pptx'), { slides: { 'slide1.xml': SLIDE_LAYOUT } })
    const { slides } = await parsePptx(file)
    const els = slides[0].elements
    expect(els).toHaveLength(2)
    // Title box: 1000000 EMU / 12192000 * 1920 ≈ 157px x, 500000/6858000*1080 ≈ 79px y
    expect(els[0].x).toBeGreaterThan(140)
    expect(els[0].x).toBeLessThan(175)
    expect(els[0].text).toBe('Title Here')
    expect(els[0].color).toBe('#343434')
    // Body box sits lower and wider
    expect(els[1].y).toBeGreaterThan(els[0].y)
    expect(els[1].width).toBeGreaterThan(els[0].width)
  })

  it('bakes auto-numbering and bullet markers into the body text', async () => {
    const file = buildPptx(path.join(tmpDir, 'lists.pptx'), { slides: { 'slide1.xml': SLIDE_LAYOUT } })
    const { slides } = await parsePptx(file)
    const body = slides[0].elements[1].text
    expect(body).toContain('1. First question')
    expect(body).toContain('2. Second question')
    expect(body).toContain('• A sub point')
    // Level-1 bullet is indented deeper than the level-0 numbers
    expect(body).toMatch(/\n {4}• A sub point/)
  })

  it('honors authored font sizes above the flat-style clamp for positioned text', async () => {
    // sz=4800 → 48pt × 2px/pt = 96px; the legacy style clamp is 110 but a big
    // title (e.g. 127pt) must survive as a positioned element.
    const BIG = sld(`<p:sp>
      <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="6000000" cy="3000000"/></a:xfrm></p:spPr>
      <p:txBody><a:p><a:r><a:rPr sz="12700"/><a:t>Discussion</a:t></a:r></a:p></p:txBody>
    </p:sp>`)
    const file = buildPptx(path.join(tmpDir, 'bigtitle.pptx'), { slides: { 'slide1.xml': BIG } })
    const { slides } = await parsePptx(file)
    // 127pt × 2 = 254px, under the 300 element ceiling
    expect(slides[0].elements[0].fontSize).toBe(254)
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('parsePptx — error handling', () => {
  it('rejects (not crashes) on a file that is not a zip', async () => {
    const bogus = path.join(tmpDir, 'bogus.pptx')
    fs.writeFileSync(bogus, 'this is not a zip archive')
    await expect(parsePptx(bogus)).rejects.toThrow()
  })

  it('rejects on a missing file', async () => {
    await expect(parsePptx(path.join(tmpDir, 'nope.pptx'))).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Integration — the user's real decks (skipped on machines without them)
// ---------------------------------------------------------------------------

const SESSION_DIR = 'C:/Users/MSI/Desktop/session slides'

function findPptxFiles(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...findPptxFiles(p))
    else if (/\.pptx$/i.test(e.name) && !e.name.startsWith('~$')) out.push(p)
  }
  return out
}

describe.runIf(fs.existsSync(SESSION_DIR))('parsePptx — real session decks', () => {
  it('parses every deck in the session slides folder with valid output', { timeout: 60000 }, async () => {
    const files = findPptxFiles(SESSION_DIR)
    expect(files.length).toBeGreaterThan(0)

    for (const f of files) {
      const result = await parsePptx(f)
      expect(result.name).toBeTruthy()
      expect(result.slides.length).toBeGreaterThan(0)

      for (const [i, s] of result.slides.entries()) {
        const label = `${path.basename(f)} slide ${i + 1}`
        // No leftover encoded entities in visible text
        expect(s.text, label).not.toMatch(/&(amp|lt|gt|quot|apos|#\d+);/)
        const st = s.style || {}
        if (st.fontSize !== undefined) {
          expect(st.fontSize, label).toBeGreaterThanOrEqual(24)
          expect(st.fontSize, label).toBeLessThanOrEqual(110)
        }
        if (st.color !== undefined) expect(st.color, label).toMatch(/^#[0-9a-fA-F]{6}$/)
        if (st.hAlign !== undefined) expect(['left', 'center', 'right', 'justify'], label).toContain(st.hAlign)
        if (st.vAlign !== undefined) expect(['top', 'center', 'bottom'], label).toContain(st.vAlign)
        if (st.lineSpacing !== undefined) {
          expect(st.lineSpacing, label).toBeGreaterThan(0)
          expect(st.lineSpacing, label).toBeLessThan(4)
        }
        if (s.bgImage !== null) expect(s.bgImage, label).toMatch(/^data:image\/(png|jpeg|webp);base64,/)
      }
    }
  })
})
