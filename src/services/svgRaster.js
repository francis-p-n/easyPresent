/**
 * svgRaster — turns an SVG picture into a PNG at screen size.
 *
 * An SVG with no width/height (common from design tools) has no size of its own, so a canvas or a
 * thumbnail cannot draw it reliably, and a very detailed one is slow to repaint on every slide
 * change. Drawing it once to a canvas at the projector's size gives every part of the app an
 * ordinary image. Anything that is not an SVG, or any failure, hands the original back untouched.
 */

export const SVG_MIME = 'image/svg+xml'
const DESIGN_W = 1920
const DESIGN_H = 1080

export const isSvgDataUrl = (url) => typeof url === 'string' && url.slice(0, 40).toLowerCase().startsWith(`data:${SVG_MIME}`)

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('SVG could not be read'))
    img.src = url
  })
}

/** The size to draw at: the SVG's own shape (or 16:9 when it has none), fitted inside maxW x maxH. */
export function rasterSize(naturalW, naturalH, maxW = DESIGN_W, maxH = DESIGN_H) {
  const w = naturalW > 0 ? naturalW : maxW
  const h = naturalH > 0 ? naturalH : maxH
  const scale = Math.min(maxW / w, maxH / h)
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

/** SVG data URL -> PNG data URL. Other inputs are returned as they are. */
export async function rasterizeIfSvg(dataUrl, { load = loadImage, makeCanvas = () => document.createElement('canvas'), maxW, maxH } = {}) {
  if (!isSvgDataUrl(dataUrl)) return dataUrl
  try {
    const img = await load(dataUrl)
    const { width, height } = rasterSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxW, maxH)
    const canvas = makeCanvas()
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return dataUrl
    ctx.drawImage(img, 0, 0, width, height)
    const png = canvas.toDataURL('image/png')
    return png && png.startsWith('data:image/png') ? png : dataUrl
  } catch {
    return dataUrl
  }
}
