/**
 * serviceLook — one background and text style for a whole service.
 *
 * A service (setlist) can carry `meta.look`:
 *   { background: { type: 'media' | 'video' | 'color', mediaPath?, color? } | null,
 *     dim: 0-80 (percent of black laid over the background, so light pictures stay readable),
 *     textColor, fontFamily, fontSize (px) }
 *
 * Precedence, most specific first:  the slide's own background / style  >  the service look  >  the theme.
 * A slide that has a background of its own (an imported design, one set in the editor) keeps it.
 */

export const MAX_DIM = 80

const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function normalizeBackground(raw) {
  if (!raw || typeof raw !== 'object') return null
  const color = COLOR_RE.test(String(raw.color || '')) ? raw.color : ''
  const mediaPath = typeof raw.mediaPath === 'string' ? raw.mediaPath : ''
  if ((raw.type === 'media' || raw.type === 'video') && mediaPath) return { type: raw.type, mediaPath, ...(color ? { color } : {}) }
  if (color) return { type: 'color', color }
  return null
}

/** A complete, clean look. */
export function normalizeLook(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const size = Number(r.fontSize)
  return {
    background: normalizeBackground(r.background),
    dim: Number.isFinite(Number(r.dim)) ? Math.min(MAX_DIM, Math.max(0, Math.round(Number(r.dim)))) : 0,
    textColor: COLOR_RE.test(String(r.textColor || '')) ? r.textColor : '',
    fontFamily: text(r.fontFamily, 80),
    fontSize: Number.isFinite(size) && size > 0 ? Math.min(300, Math.max(12, Math.round(size))) : 0
  }
}

/** True when the look changes nothing. */
export function isEmptyLook(look) {
  const l = normalizeLook(look)
  return !l.background && !l.textColor && !l.fontFamily && !l.fontSize
}

/**
 * What to draw with: the slide's own background if it has one, else the look's. `dim` is only
 * used over the look's background, never over a slide's own design. `themeStyles` gains the
 * look's text choices (a slide's own style still wins when it is applied on top).
 */
export function applyLook(look, themeStyles, slideBackground) {
  const l = normalizeLook(look)
  const ownBackground = slideBackground && (slideBackground.mediaPath || slideBackground.color) ? slideBackground : null
  const background = ownBackground || l.background || slideBackground || null
  const usesLook = !ownBackground && !!l.background
  const styles = { ...(themeStyles || {}) }
  if (l.textColor) styles.color = l.textColor
  if (l.fontFamily) styles.fontFamily = l.fontFamily
  if (l.fontSize) styles.fontSize = `${l.fontSize}px`
  return {
    background,
    dim: usesLook ? l.dim : 0,
    themeStyles: themeStyles || Object.keys(styles).length ? styles : null
  }
}

/**
 * A black layer between the background (picture or video) and the text. Both sit at z-index -1 inside
 * an isolated host, so this one, inserted after the video, covers it and stays under the content.
 */
export function placeDim(host, percent, id = 'output-dim') {
  const old = host.querySelector(`#${id}`)
  if (!(percent > 0)) {
    old?.remove()
    return null
  }
  const layer = old || host.ownerDocument.createElement('div')
  layer.id = id
  layer.style.cssText = `position:absolute;inset:0;z-index:-1;pointer-events:none;background:rgba(0,0,0,${percent / 100});`
  host.style.isolation = 'isolate'
  if (!old) {
    const video = host.querySelector('video')
    if (video && video.nextSibling) host.insertBefore(layer, video.nextSibling)
    else if (video) host.appendChild(layer)
    else host.insertBefore(layer, host.firstChild)
  }
  return layer
}

/** The look of the service now open (the setlist the operator is working from). */
export const currentLook = (state) => state.get('activePlaylist')?.meta?.look || null
