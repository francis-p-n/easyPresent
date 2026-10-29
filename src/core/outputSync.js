/**
 * outputSync — builds the state payload the audience output window renders.
 *
 * The operator window owns all state; the output window is a dumb renderer
 * fed over IPC. The payload carries everything needed to draw one frame of
 * output: the live slide (text + per-slide style + background), the message
 * overlay, the logo/clear state, and the active theme's base styles.
 */

import { fontsForPayload } from '../services/fontStore.js'
import { applyLook } from './serviceLook.js'

export const TRANSITION_TYPES = ['cut', 'dissolve', 'wipe']

/**
 * Resolves the transition into the slide now going live: a per-slide override
 * wins, then the presentation's own, then the global default; unknown values degrade to a hard cut.
 */
export function resolveTransition(slide, globalType, globalMs, presentationType) {
  const type = TRANSITION_TYPES.includes(slide?.transition)
    ? slide.transition
    : TRANSITION_TYPES.includes(presentationType)
      ? presentationType
      : globalType
  const ms = Number.isFinite(globalMs) ? Math.min(3000, Math.max(0, globalMs)) : 400
  return TRANSITION_TYPES.includes(type) && type !== 'cut' && ms > 0 ? { type, ms } : { type: 'cut', ms: 0 }
}

/**
 * Assemble the render payload from app state.
 * `options.hideSlide` is the audience "Look" that keeps slide text off this
 * screen (e.g. during the sermon) without clearing it for the other outputs.
 */
export function buildOutputPayload(layers, activeTheme, showLogo, timerValue, options = {}) {
  const slideLayer = layers?.slide || { active: false, content: null }
  const messageLayer = layers?.message || { active: false, content: null }
  const mediaLayer = layers?.media || { active: false, content: null }

  let message = null
  if (messageLayer.active && messageLayer.content) {
    message = messageLayer.content
    if (message.includes('{timer}')) {
      message = message.replace('{timer}', timerValue || '00:00')
    }
  }

  const content = slideLayer.active ? slideLayer.content : null
  // The open service's own background and text style, under anything the slide sets itself
  const looked = applyLook(options.look, activeTheme?.styles, content?.background)

  return {
    slide: content
      ? {
          text: content.text || '',
          style: content.style || null,
          background: looked.background,
          // Positioned layout (imported PPTX). When present, the output window
          // renders these faithfully instead of the flat single text block.
          elements: content.elements && content.elements.length ? content.elements : null,
          images: content.images && content.images.length ? content.images : null
        }
      : null,
    message,
    showLogo: !!showLogo,
    hideSlide: !!options.hideSlide,
    transition: resolveTransition(content, options.transition, options.transitionMs, options.presentationTransition),
    // The picture or video the operator put on the media layer: it replaces the slide's own background
    media: mediaLayer.active && mediaLayer.content && mediaLayer.content.src ? { type: mediaLayer.content.type === 'video' ? 'video' : 'image', src: mediaLayer.content.src } : null,
    themeStyles: looked.themeStyles,
    dim: content ? looked.dim : 0,
    // Only the added fonts this slide uses, so the audience screen can draw them
    fonts: content ? fontsForPayload(options.userFonts, content, activeTheme?.styles) : null
  }
}

/**
 * Cheap change signature. Imported slides carry multi-MB base64 backgrounds —
 * hashing those per state change would burn the main thread, so backgrounds
 * are represented by type + length only.
 */
export function payloadSignature(payload) {
  const bg = payload.slide?.background
  const bgMarker = bg ? `${bg.type}:${bg.color || ''}:${bg.mediaPath ? bg.mediaPath.length : 0}` : ''
  // Positioned layout: hash geometry + text cheaply; image data URLs are
  // represented by length only (they can be multi-MB base64).
  const els = payload.slide?.elements
  const elMarker = els
    ? els.map((e) => `${e.x},${e.y},${e.width},${e.height},${e.fontSize},${e.fontFamily || ''},${e.color || ''},${e.letterSpacing || ''},${e.text},${e.runs ? JSON.stringify(e.runs) : ''}`).join('|')
    : ''
  const imgs = payload.slide?.images
  const imgMarker = imgs
    ? imgs.map((i) => `${i.x},${i.y},${i.width},${i.height},${i.mediaPath ? i.mediaPath.length : 0}`).join('|')
    : ''
  return JSON.stringify([
    payload.slide?.text ?? null,
    payload.slide?.style ?? null,
    bgMarker,
    elMarker,
    imgMarker,
    payload.message,
    payload.showLogo,
    payload.hideSlide,
    payload.transition,
    payload.themeStyles,
    payload.dim,
    payload.media ? `${payload.media.type}:${payload.media.src.length}:${payload.media.src.slice(-40)}` : null,
    payload.fonts ? payload.fonts.map((f) => `${f.family}:${f.dataUrl.length}`) : null
  ])
}
