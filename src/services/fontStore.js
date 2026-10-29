/**
 * fontStore — fonts the operator adds from font files (.ttf .otf .woff .woff2).
 *
 * A slide that names a font the computer does not have silently falls back to something else, and
 * the projector computer is often not the one the slides were made on. Adding the font file once
 * stores it inside the library (so it is saved, exported and backed up with the songs) and the
 * app registers it for every window. The audience screen is sent only the fonts the live slide
 * actually uses, as part of the output payload.
 */

export const FONT_EXTENSIONS = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }
export const MAX_FONT_BYTES = 8 * 1024 * 1024
export const MAX_USER_FONTS = 30
export const FONT_STYLE_ID = 'ep-user-fonts'

const extensionOf = (name) => String(name || '').split('.').pop().toLowerCase()

export const isFontFileName = (name) => Object.prototype.hasOwnProperty.call(FONT_EXTENSIONS, extensionOf(name))

/** "Playfair-Display_Bold.ttf" -> "Playfair Display" (the style words are the font file's, not the family's). */
export function familyFromFileName(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '')
  const words = base
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+(regular|bold|italic|oblique|light|medium|semibold|black|thin|book)(\s+(italic|oblique))?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return words.slice(0, 60) || 'Custom font'
}

/** Keeps only well-formed entries: { id, family, dataUrl }. */
export function cleanUserFonts(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const f of raw) {
    if (!f || typeof f.family !== 'string' || typeof f.dataUrl !== 'string' || !f.dataUrl.startsWith('data:')) continue
    const family = f.family.trim().slice(0, 60)
    const key = family.toLowerCase()
    if (!family || seen.has(key)) continue
    seen.add(key)
    out.push({ id: typeof f.id === 'string' && f.id ? f.id : `font-${out.length}-${key.replace(/\W+/g, '')}`, family, dataUrl: f.dataUrl })
  }
  return out.slice(0, MAX_USER_FONTS)
}

/** Adds a font, replacing one that has the same name. */
export function addUserFont(list, { family, dataUrl }) {
  const name = String(family || '').trim()
  const rest = cleanUserFonts(list).filter((f) => f.family.toLowerCase() !== name.toLowerCase())
  return cleanUserFonts([...rest, { id: `font-${Date.now().toString(36)}-${rest.length}`, family: name, dataUrl }])
}

export const removeUserFont = (list, id) => cleanUserFonts(list).filter((f) => f.id !== id)

const cssString = (s) => String(s).replace(/[\\"]/g, '\\$&').replace(/[\r\n]/g, ' ')

/** The @font-face rules for these fonts. */
export function fontFaceCss(fonts) {
  return cleanUserFonts(fonts)
    .map((f) => `@font-face{font-family:"${cssString(f.family)}";src:url("${cssString(f.dataUrl)}");font-display:swap;}`)
    .join('\n')
}

/** Puts the fonts into the page (one <style> element, replaced as the list changes). */
export function registerUserFonts(fonts, doc = document) {
  const css = fontFaceCss(fonts)
  let style = doc.getElementById(FONT_STYLE_ID)
  if (!css) {
    style?.remove()
    return
  }
  if (!style) {
    style = doc.createElement('style')
    style.id = FONT_STYLE_ID
    doc.head.appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css
}

/** Every font family a live slide (and the theme behind it) asks for, lower-cased. */
export function usedFamilies(slide, themeStyles) {
  const names = new Set()
  const add = (v) => {
    if (typeof v !== 'string') return
    for (const part of v.split(',')) {
      const n = part.trim().replace(/^["']|["']$/g, '').toLowerCase()
      if (n) names.add(n)
    }
  }
  add(themeStyles?.fontFamily)
  add(slide?.style?.fontFamily)
  for (const el of slide?.elements || []) {
    add(el.fontFamily)
    for (const r of el.runs || []) add(r.fontFamily)
  }
  return names
}

/** The user fonts the output needs for this slide: [{ family, dataUrl }], or null for none. */
export function fontsForPayload(fonts, slide, themeStyles) {
  const list = cleanUserFonts(fonts)
  if (!list.length) return null
  const used = usedFamilies(slide, themeStyles)
  const needed = list.filter((f) => used.has(f.family.toLowerCase())).map(({ family, dataUrl }) => ({ family, dataUrl }))
  return needed.length ? needed : null
}

/** Reads a chosen font file into { family, dataUrl }, or throws a message the operator can read. */
export function readFontFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !isFontFileName(file.name)) return reject(new Error('Choose a .ttf, .otf, .woff or .woff2 font file.'))
    if (file.size > MAX_FONT_BYTES) return reject(new Error('That font file is over 8 MB.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('That font file could not be read.'))
    reader.onload = () => {
      const mime = FONT_EXTENSIONS[extensionOf(file.name)]
      const url = String(reader.result).replace(/^data:[^;,]*/, `data:${mime}`)
      resolve({ family: familyFromFileName(file.name), dataUrl: url })
    }
    reader.readAsDataURL(file)
  })
}
