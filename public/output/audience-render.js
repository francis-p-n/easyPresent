// Audience output renderer — turns an output payload into DOM/CSS.
// Plain script (no build step): loaded by audience.html, exercised in tests
// via a VM sandbox. All font/offset values in the payload are authored in
// the app's 1920px design space; `scale` maps them to the real screen.

// `viewport` ({ w, h } in px) is optional. Plain text scales with `scale` (the caller picks a
// size that suits the screen's shape); positioned layouts are authored on a 16:9 page, so with a
// viewport they are fitted and centred on it instead of being stretched to the width alone.
function renderAudienceState(state, root, scale, viewport) {
  // A background video that is already playing is kept across redraws, so the loop does not restart on every slide
  var keptVideo = root.querySelector ? root.querySelector('#output-bg-video') : null
  if (keptVideo) keptVideo.remove()
  root.innerHTML = ''
  root.style.position = 'relative'
  root.style.width = '100%'
  root.style.height = '100%'
  root.style.overflow = 'hidden'
  root.style.background = '#000'

  if (!state) return
  registerAudienceFonts(state.fonts)

  // showLogo/no-slide only blank the SLIDE — a message (e.g. "Starting
  // soon...") must still show over the black screen, same as the operator's
  // own Output Preview.
  const showSlide = !state.showLogo && !state.hideSlide && state.slide
  if (state.showLogo) renderLogo(root, scale)

  const theme = state.themeStyles || {}

  if (showSlide) {
    const style = Object.assign(
      {
        fontFamily: theme.fontFamily || 'Inter',
        fontSize: parseFloat(theme.fontSize) || 48,
        color: theme.color || '#FFFFFF',
        bold: theme.fontWeight ? theme.fontWeight === 'bold' : true,
        italic: false,
        hAlign: theme.textAlign || 'center',
        vAlign: 'center',
        lineSpacing: 1.35
      },
      state.slide.style || {}
    )

    // Background layer
    const bg = state.slide.background
    if (bg && bg.type === 'media' && bg.mediaPath) {
      root.style.background = `#000 url("${bg.mediaPath}") center / cover no-repeat`
    } else if (bg && bg.type === 'video' && bg.mediaPath) {
      root.style.background = bg.color || '#000'
      placeAudienceVideo(root, bg, keptVideo)
    } else if (bg && bg.color) {
      root.style.background = bg.color
    } else if (theme.backgroundColor) {
      root.style.background = theme.backgroundColor
    }

    // Imported layout slides carry positioned text boxes + images — render
    // them faithfully instead of the flat single text block.
    const hasLayout =
      (state.slide.elements && state.slide.elements.length) ||
      (state.slide.images && state.slide.images.length)
    if (hasLayout) {
      if (viewport && viewport.w > 0 && viewport.h > 0) {
        const fit = Math.min(viewport.w / 1920, viewport.h / 1080)
        const page = document.createElement('div')
        page.id = 'output-page'
        Object.assign(page.style, {
          position: 'absolute',
          left: `${(viewport.w - 1920 * fit) / 2}px`,
          top: `${(viewport.h - 1080 * fit) / 2}px`,
          width: `${1920 * fit}px`,
          height: `${1080 * fit}px`,
          overflow: 'hidden'
        })
        root.appendChild(page)
        renderSlideLayout(state.slide, page, fit)
      } else {
        renderSlideLayout(state.slide, root, scale)
      }
    } else {
      renderSlideText(state.slide.text, style, root, scale)
    }
  }

  renderMessage(state.message, root, scale)
}

// Paints a new frame, optionally easing out of the previous one. The old frame
// is lifted into an overlay that fades (dissolve) or slides away (wipe) over
// the freshly painted one, then removes itself. A cut just paints.
function transitionAudience(state, root, scale, transition, viewport) {
  const type = transition && transition.type
  const ms = (transition && transition.ms) || 0
  // A frame arriving mid-transition: drop the stale overlay instead of nesting it
  root.querySelectorAll('.output-transition-old').forEach((n) => n.remove())
  const hadFrame = root.children.length > 0
  if ((type !== 'dissolve' && type !== 'wipe') || !ms || !hadFrame) {
    renderAudienceState(state, root, scale, viewport)
    return
  }

  const old = document.createElement('div')
  old.className = 'output-transition-old'
  Object.assign(old.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '1000',
    pointerEvents: 'none',
    overflow: 'hidden',
    background: root.style.background
  })
  while (root.firstChild) old.appendChild(root.firstChild)

  renderAudienceState(state, root, scale, viewport)
  root.appendChild(old)

  const done = () => old.parentNode && old.parentNode.removeChild(old)
  const from = type === 'dissolve' ? { opacity: 1 } : { clipPath: 'inset(0 0 0 0)' }
  const to = type === 'dissolve' ? { opacity: 0 } : { clipPath: 'inset(0 0 0 100%)' }
  if (typeof old.animate === 'function') {
    const anim = old.animate([from, to], { duration: ms, easing: 'ease-in-out', fill: 'forwards' })
    anim.onfinish = done
  }
  // Backstop: also covers environments without the Web Animations API
  setTimeout(done, ms + 50)
}

// PPTX <a:fillRect> insets (1000ths of a percent) → inner image box as % of the
// shape. Mirror of src/engine/slideLayout.js fillRectStyle.
function fillRectStyle(fill) {
  if (!fill) return { left: 0, top: 0, width: 100, height: 100 }
  return {
    left: fill.l / 1000,
    top: fill.t / 1000,
    width: (100000 - fill.l - fill.r) / 1000,
    height: (100000 - fill.t - fill.b) / 1000
  }
}

// fillRect frame composed with an <a:srcRect> source crop. Mirror of
// src/engine/slideLayout.js imageFrameStyle.
function imageFrameStyle(fill, crop) {
  const f = fillRectStyle(fill)
  if (!crop) return f
  const wFrac = (100000 - crop.l - crop.r) / 100000
  const hFrac = (100000 - crop.t - crop.b) / 100000
  if (wFrac <= 0 || hFrac <= 0) return f
  const width = f.width / wFrac
  const height = f.height / hFrac
  return {
    left: f.left - (crop.l / 100000) * width,
    top: f.top - (crop.t / 100000) * height,
    width,
    height
  }
}

// Rotation + flip transform. Mirror of src/engine/slideLayout.js shapeTransform.
function shapeTransform(img) {
  const parts = []
  if (img.rot) parts.push(`rotate(${img.rot}deg)`)
  if (img.flipH || img.flipV) parts.push(`scale(${img.flipH ? -1 : 1}, ${img.flipV ? -1 : 1})`)
  return parts.join(' ')
}

// Positioned layout renderer — mirror of src/engine/slideLayout.js, but for the
// standalone output window (no module system). All coordinates are in the
// 1920×1080 design space; `scale` maps them to the real screen.
function renderSlideLayout(slide, root, scale) {
  const images = slide.images || []
  const elements = slide.elements || []

  images.forEach((img) => {
    if (!img.mediaPath) return
    const box = document.createElement('div')
    Object.assign(box.style, {
      position: 'absolute',
      overflow: 'hidden',
      left: `${img.x * scale}px`,
      top: `${img.y * scale}px`,
      width: `${img.width * scale}px`,
      height: `${img.height * scale}px`
    })
    const transform = shapeTransform(img)
    if (transform) box.style.transform = transform
    const f = imageFrameStyle(img.fill, img.crop)
    const inner = document.createElement('img')
    inner.src = img.mediaPath
    Object.assign(inner.style, {
      position: 'absolute',
      left: `${f.left}%`,
      top: `${f.top}%`,
      width: `${f.width}%`,
      height: `${f.height}%`
    })
    box.appendChild(inner)
    root.appendChild(box)
  })

  elements.forEach((el) => {
    const box = document.createElement('div')
    Object.assign(box.style, {
      position: 'absolute',
      left: `${el.x * scale}px`,
      top: `${el.y * scale}px`,
      width: `${el.width * scale}px`,
      height: `${el.height * scale}px`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent:
        el.vAlign === 'top' ? 'flex-start' : el.vAlign === 'bottom' ? 'flex-end' : 'center',
      alignItems:
        el.hAlign === 'left' ? 'flex-start' : el.hAlign === 'right' ? 'flex-end' : 'center',
      overflow: 'hidden'
    })
    const text = document.createElement('div')
    Object.assign(text.style, {
      width: '100%',
      fontFamily: `"${el.fontFamily || 'Inter'}", sans-serif`,
      fontSize: `${(el.fontSize || 48) * scale}px`,
      color: el.color || '#ffffff',
      fontWeight: el.bold ? '700' : '400',
      fontStyle: el.italic ? 'italic' : 'normal',
      textDecoration: el.underline ? 'underline' : 'none',
      textAlign: ['left', 'center', 'right'].includes(el.hAlign) ? el.hAlign : 'left',
      lineHeight: String(el.lineSpacing || 1.2),
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word'
    })
    fillRuns(text, el.text || '', el.runs, scale)
    box.appendChild(text)
    root.appendChild(box)
  })
}

// Looping background video (a file on this computer), behind everything else.
function placeAudienceVideo(root, bg, kept) {
  var video = kept && kept.getAttribute('src') === bg.mediaPath ? kept : null
  if (!video) {
    video = document.createElement('video')
    video.id = 'output-bg-video'
    video.setAttribute('src', bg.mediaPath)
    video.muted = true
    video.loop = true
    video.autoplay = true
    video.playsInline = true
    video.setAttribute('muted', '')
    video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none;'
  }
  root.style.isolation = 'isolate'
  root.insertBefore(video, root.firstChild)
  var started = video.play && video.play()
  if (started && started.catch) started.catch(function () {})
}

// Fonts the operator added, sent with the slide that uses them. One <style> element, rewritten only when the list changes.
function registerAudienceFonts(fonts) {
  if (!Array.isArray(fonts) || !fonts.length) return
  var css = fonts
    .map(function (f) {
      var family = String(f.family).replace(/["\\]/g, '')
      var url = String(f.dataUrl).replace(/["\\]/g, '')
      return '@font-face{font-family:"' + family + '";src:url("' + url + '");}'
    })
    .join('\n')
  var style = document.getElementById('ep-audience-fonts')
  if (!style) {
    style = document.createElement('style')
    style.id = 'ep-audience-fonts'
    document.head.appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css
}

// Text with per-range formatting (bold word, red phrase from a PPTX import) as styled spans.
function fillRuns(target, text, runs, scale) {
  var valid = (Array.isArray(runs) ? runs : [])
    .filter(function (r) { return r && r.start >= 0 && r.end > r.start && r.start < text.length })
    .sort(function (a, b) { return a.start - b.start })
  if (!valid.length) {
    target.textContent = text
    return
  }
  var at = 0
  valid.forEach(function (r) {
    if (r.start < at) return
    if (r.start > at) target.appendChild(document.createTextNode(text.slice(at, r.start)))
    var span = document.createElement('span')
    span.textContent = text.slice(r.start, Math.min(r.end, text.length))
    if (r.bold !== undefined) span.style.fontWeight = r.bold ? '700' : '400'
    if (r.italic !== undefined) span.style.fontStyle = r.italic ? 'italic' : 'normal'
    if (r.underline !== undefined) span.style.textDecoration = r.underline ? 'underline' : 'none'
    if (r.color) span.style.color = r.color
    if (r.fontFamily) span.style.fontFamily = '"' + r.fontFamily + '", sans-serif'
    if (r.fontSize) span.style.fontSize = r.fontSize * scale + 'px'
    target.appendChild(span)
    at = Math.min(r.end, text.length)
  })
  if (at < text.length) target.appendChild(document.createTextNode(text.slice(at)))
}

function renderSlideText(text, style, root, scale) {
  if (!text) return

  const box = document.createElement('div')
  box.id = 'output-text'
  const fontPx = (parseFloat(style.fontSize) || 48) * scale
  const strokePx = Math.max(1, 2.5 * scale)
  const shadowPx = Math.max(1, 3 * scale)
  Object.assign(box.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent:
      style.vAlign === 'top' ? 'flex-start' : style.vAlign === 'bottom' ? 'flex-end' : 'center',
    alignItems:
      style.hAlign === 'left' ? 'flex-start' : style.hAlign === 'right' ? 'flex-end' : 'center',
    textAlign: ['left', 'center', 'right'].includes(style.hAlign) ? style.hAlign : 'center',
    padding: `${40 * scale}px ${60 * scale}px`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere', // a very long word wraps instead of being clipped at the screen edge
    fontFamily: `"${style.fontFamily}", Inter, sans-serif`,
    fontSize: `${fontPx}px`,
    fontWeight: style.bold ? 'bold' : 'normal',
    fontStyle: style.italic ? 'italic' : 'normal',
    lineHeight: String(style.lineSpacing || 1.35),
    color: style.color,
    textShadow: `${shadowPx}px ${shadowPx}px ${shadowPx * 2}px rgba(0,0,0,0.75)`,
    webkitTextStroke: `${strokePx}px rgba(0,0,0,0.35)`
  })
  box.textContent = text
  root.appendChild(box)
}

// Message overlay — bottom-center pill, above everything. Independent of the
// slide layer: a message must show even with no live slide (regression —
// see the equivalent fix in src/features/stage/PreviewPanel.js).
function renderMessage(message, root, scale) {
  if (!message) return

  const pill = document.createElement('div')
  pill.id = 'output-message'
  Object.assign(pill.style, {
    position: 'absolute',
    bottom: `${60 * scale}px`,
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: '80%',
    padding: `${16 * scale}px ${32 * scale}px`,
    borderRadius: `${12 * scale}px`,
    background: 'rgba(0,0,0,0.8)',
    color: '#FFFFFF',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 'bold',
    fontSize: `${40 * scale}px`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  })
  pill.textContent = message
  root.appendChild(pill)
}

// eslint-disable-next-line no-unused-vars -- consumed by audience.html glue script
if (typeof module !== 'undefined' && module.exports) module.exports = { renderAudienceState, transitionAudience }

// The logo screen. With no custom logo it must still look deliberate, not like a dead
// projector, so it shows a simple mark and the app name.
function renderLogo(root, scale) {
  const box = document.createElement('div')
  box.id = 'output-logo'
  Object.assign(box.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: `${28 * scale}px`,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Inter, sans-serif'
  })
  const mark = document.createElement('div')
  mark.textContent = 'EP'
  Object.assign(mark.style, {
    width: `${200 * scale}px`,
    height: `${200 * scale}px`,
    borderRadius: `${44 * scale}px`,
    background: 'linear-gradient(135deg, #4f7cff, #7f6bff)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${84 * scale}px`,
    fontWeight: '700'
  })
  const name = document.createElement('div')
  name.textContent = 'EasyPresent'
  Object.assign(name.style, { fontSize: `${56 * scale}px`, fontWeight: '600', letterSpacing: '0.02em' })
  box.append(mark, name)
  root.appendChild(box)
}

