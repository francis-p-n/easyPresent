/**
 * outputSync — builds the state payload the audience output window renders.
 *
 * The operator window owns all state; the output window is a dumb renderer
 * fed over IPC. The payload carries everything needed to draw one frame of
 * output: the live slide (text + per-slide style + background), the message
 * overlay, the logo/clear state, and the active theme's base styles.
 */

/** Assemble the render payload from app state. */
export function buildOutputPayload(layers, activeTheme, showLogo, timerValue) {
  const slideLayer = layers?.slide || { active: false, content: null }
  const messageLayer = layers?.message || { active: false, content: null }

  let message = null
  if (messageLayer.active && messageLayer.content) {
    message = messageLayer.content
    if (message.includes('{timer}')) {
      message = message.replace('{timer}', timerValue || '00:00')
    }
  }

  const content = slideLayer.active ? slideLayer.content : null

  return {
    slide: content
      ? {
          text: content.text || '',
          style: content.style || null,
          background: content.background || null,
          // Positioned layout (imported PPTX). When present, the output window
          // renders these faithfully instead of the flat single text block.
          elements: content.elements && content.elements.length ? content.elements : null,
          images: content.images && content.images.length ? content.images : null
        }
      : null,
    message,
    showLogo: !!showLogo,
    themeStyles: activeTheme?.styles || null
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
    ? els.map((e) => `${e.x},${e.y},${e.width},${e.height},${e.fontSize},${e.text}`).join('|')
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
    payload.themeStyles
  ])
}
