/**
 * slideLayout — renders a slide's positioned images + text elements into a
 * container, scaled to whatever size that container is.
 *
 * Everything is authored in the app's 1920×1080 design space. Rather than
 * measure the container and compute a scale in JS (fragile during layout), the
 * container is made a CSS *size query container* and every position/size/font
 * is expressed in `cqw`/`cqh` units — percentages of the container's own box.
 * The same function therefore works for a tiny library thumbnail, the output
 * preview, and a full-screen audience display with no per-surface math.
 */

const DESIGN_W = 1920
const DESIGN_H = 1080

const wpct = (px) => (px / DESIGN_W) * 100 // → cqw
const hpct = (px) => (px / DESIGN_H) * 100 // → cqh

/**
 * PPTX <a:fillRect> insets (1000ths of a percent) → the inner image's box as
 * percentages of the shape. Default (no fill) is a plain stretch-to-fill.
 * Negative insets make the image larger than the shape so it shows a cropped
 * window — exactly how PowerPoint frames a decoration.
 */
export function fillRectStyle(fill) {
  if (!fill) return { left: 0, top: 0, width: 100, height: 100 }
  return {
    left: fill.l / 1000,
    top: fill.t / 1000,
    width: (100000 - fill.l - fill.r) / 1000,
    height: (100000 - fill.t - fill.b) / 1000
  }
}

/** True when a slide carries positioned layout the flat renderers can't show. */
export function hasLayout(slide) {
  return !!(slide && ((slide.elements && slide.elements.length) || (slide.images && slide.images.length)))
}

/**
 * Appends a positioned layout into `container`. Returns the layer element.
 * `container` becomes a size container; its existing children are left intact
 * (callers set the background on it separately).
 */
export function renderSlideLayout(container, { elements = [], images = [] } = {}) {
  container.style.containerType = 'size'
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative'

  const layer = document.createElement('div')
  layer.className = 'slide-layout-layer'
  layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;'

  // Images render first so they sit behind the text. Each is a clipping box
  // (the shape) containing an <img> framed per the PPTX fillRect.
  images.forEach((img) => {
    if (!img.mediaPath) return
    const box = document.createElement('div')
    box.style.cssText =
      `position:absolute;overflow:hidden;` +
      `left:${wpct(img.x)}cqw;top:${hpct(img.y)}cqh;` +
      `width:${wpct(img.width)}cqw;height:${hpct(img.height)}cqh;`
    const f = fillRectStyle(img.fill)
    const inner = document.createElement('img')
    inner.src = img.mediaPath
    inner.style.cssText =
      `position:absolute;left:${f.left}%;top:${f.top}%;width:${f.width}%;height:${f.height}%;`
    box.appendChild(inner)
    layer.appendChild(box)
  })

  elements.forEach((el) => {
    const box = document.createElement('div')
    const vAlign = el.vAlign === 'top' ? 'flex-start' : el.vAlign === 'bottom' ? 'flex-end' : 'center'
    const hAlign = el.hAlign === 'left' ? 'flex-start' : el.hAlign === 'right' ? 'flex-end' : 'center'
    box.style.cssText =
      `position:absolute;` +
      `left:${wpct(el.x)}cqw;top:${hpct(el.y)}cqh;` +
      `width:${wpct(el.width)}cqw;height:${hpct(el.height)}cqh;` +
      `display:flex;flex-direction:column;justify-content:${vAlign};align-items:${hAlign};` +
      `overflow:hidden;`

    const text = document.createElement('div')
    text.textContent = el.text || ''
    text.style.cssText =
      `width:100%;` +
      `font-family:"${el.fontFamily || 'Inter'}", sans-serif;` +
      `font-size:${wpct(el.fontSize || 48)}cqw;` +
      `color:${el.color || '#ffffff'};` +
      `font-weight:${el.bold ? 700 : 400};font-style:${el.italic ? 'italic' : 'normal'};` +
      `text-align:${['left', 'center', 'right'].includes(el.hAlign) ? el.hAlign : 'left'};` +
      `line-height:${el.lineSpacing || 1.2};` +
      `white-space:pre-wrap;word-break:break-word;`
    box.appendChild(text)
    layer.appendChild(box)
  })

  container.appendChild(layer)
  return layer
}
