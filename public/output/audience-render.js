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

    renderSlideText(state.slide.text, style, root, scale)
  }

  renderMessage(state.message, root, scale)
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
