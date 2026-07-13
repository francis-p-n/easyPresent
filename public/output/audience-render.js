// Audience output renderer — turns an output payload into DOM/CSS.
// Plain script (no build step): loaded by audience.html, exercised in tests
// via a VM sandbox. All font/offset values in the payload are authored in
// the app's 1920px design space; `scale` maps them to the real screen.

function renderAudienceState(state, root, scale) {
  root.innerHTML = ''
  root.style.position = 'relative'
  root.style.width = '100%'
  root.style.height = '100%'
  root.style.overflow = 'hidden'
  root.style.background = '#000'

  if (!state) return

  // showLogo/no-slide only blank the SLIDE — a message (e.g. "Starting
  // soon...") must still show over the black screen, same as the operator's
  // own Output Preview.
  const showSlide = !state.showLogo && state.slide

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
      renderSlideLayout(state.slide, root, scale)
    } else {
      renderSlideText(state.slide.text, style, root, scale)
    }
  }

  renderMessage(state.message, root, scale)
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
    const f = fillRectStyle(img.fill)
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
    text.textContent = el.text || ''
    Object.assign(text.style, {
      width: '100%',
      fontFamily: `"${el.fontFamily || 'Inter'}", sans-serif`,
      fontSize: `${(el.fontSize || 48) * scale}px`,
      color: el.color || '#ffffff',
      fontWeight: el.bold ? '700' : '400',
      fontStyle: el.italic ? 'italic' : 'normal',
      textAlign: ['left', 'center', 'right'].includes(el.hAlign) ? el.hAlign : 'left',
      lineHeight: String(el.lineSpacing || 1.2),
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word'
    })
    box.appendChild(text)
    root.appendChild(box)
  })
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
if (typeof module !== 'undefined' && module.exports) module.exports = { renderAudienceState }
