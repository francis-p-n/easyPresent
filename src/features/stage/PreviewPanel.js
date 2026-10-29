import { themeFor, livePresentation } from '../../core/presentationDefaults.js'
import { applyLook, placeDim, currentLook } from '../../core/serviceLook.js'
import { state } from '../../core/StateManager.js'
import NativeRender from '../../services/NativeRender.js'
import { hasLayout, renderSlideLayout } from '../../core/slideLayout.js'
import { isVideoBackground, placeBackgroundVideo } from '../../core/videoBackground.js'

/**
 * PreviewPanel — Shows live output preview using the NativeRender engine
 */
export class PreviewPanel {
  constructor(container) {
    this.container = container
    this.render()

    state.on('layers', () => this._updatePreview())
    state.on('liveSlideIndex', () => this._updatePreview())
    state.on('activeThemeId', () => this._updatePreview())
    state.on('themes', () => this._updatePreview())
    state.on('presentations', () => this._updatePreview()) // the live presentation may have just been given its own theme
    state.on('livePresentationId', () => this._updatePreview())
    state.on('showLogo', () => this._updatePreview())
    state.on('activePlaylist', () => this._updatePreview()) // the open service's background and text style
    state.on('playlists', () => this._updatePreview())
    // A message containing {timer} shows the running countdown, so the preview has
    // to tick with it (it used to freeze at 00:00 while the real screens counted down)
    state.on('timer_main', () => {
      const message = state.get('layers')?.message
      if (message?.active && String(message.content).includes('{timer}')) this._updatePreview()
    })
  }

  render() {
    this.container.innerHTML = ''

    // Header
    const header = document.createElement('div')
    header.className = 'panel-header'
    header.innerHTML = `
      <span class="panel-header__title">Output Preview</span>
      <div class="panel-header__actions">
        <span class="preview-status" id="preview-status">IDLE</span>
      </div>
    `
    this.container.appendChild(header)

    // Preview canvas area
    const previewArea = document.createElement('div')
    previewArea.className = 'preview-area'
    previewArea.id = 'preview-area'

    const previewScreen = document.createElement('div')
    previewScreen.className = 'preview-screen'
    previewScreen.id = 'preview-screen'

    // Retrieve and style the shared composite canvas from NativeRender
    const canvas = NativeRender.compositeCanvas
    if (canvas) {
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.objectFit = 'contain'
      previewScreen.appendChild(canvas)
    }

    previewArea.appendChild(previewScreen)
    this.container.appendChild(previewArea)

    this._updatePreview()
  }

  _updatePreview() {
    const status = this.container.querySelector('#preview-status')
    const screen = this.container.querySelector('#preview-screen')
    if (!status || !screen) return

    const layers = state.get('layers')
    const slideLayer = layers.slide
    // The logo covers the slide on the real screens, so the preview must not keep showing the slide
    const logoOn = !!state.get('showLogo')
    const slideOn = slideLayer.active && !logoOn

    const activeThemeId = state.get('activeThemeId')
    const themes = state.get('themes') || []
    const livePres = livePresentation(state.get('presentations'), state.get('livePresentationId'), state.get('selectedPresentation'))
    const themeBase = themeFor(livePres, themes, activeThemeId)
    // The open service's own background and text style sit under whatever the slide sets itself
    const looked = applyLook(currentLook(state), themeBase?.styles, slideLayer.content?.background)
    const activeTheme = themeBase ? { ...themeBase, styles: looked.themeStyles || themeBase.styles } : null

    // Skip redundant repaints: navigation fires both 'liveSlideIndex' and
    // 'layers', and rasterizing slide text into a GPU texture isn't free.
    const bg = looked.background
    const bgMarker = bg?.type === 'video' ? `video:${bg.mediaPath}` : bg?.mediaPath ? `media:${bg.mediaPath.length}` : `color:${bg?.color || ''}`
    const layoutMarker = hasLayout(slideLayer.content)
      ? JSON.stringify([
          (slideLayer.content.elements || []).map((e) => [e.x, e.y, e.width, e.height, e.fontSize, e.text, e.runs || null]),
          (slideLayer.content.images || []).map((i) => [i.x, i.y, i.width, i.height, i.mediaPath ? i.mediaPath.length : 0])
        ])
      : ''
    const signature = JSON.stringify([
      slideOn,
      logoOn,
      slideLayer.content?.text || '',
      slideLayer.content?.style || null, // per-slide style (e.g. PPTX import) changes the render even when text doesn't
      bgMarker,
      looked.dim,
      layoutMarker,
      layers.message?.active,
      layers.message?.content,
      activeThemeId,
      activeTheme?.styles || null, // catches in-place edits to the active theme, not just switching to a different one
      state.get('timer_main') // {timer} token in messages depends on this
    ])
    if (signature === this._lastSignature) return
    this._lastSignature = signature

    // Background is CSS-layered behind the transparent PIXI canvas so image
    // backgrounds (imported PPTX designs) work without a GPU texture pipeline
    placeBackgroundVideo(screen, slideOn && isVideoBackground(bg) ? bg : null, 'preview-bg-video')
    placeDim(screen, slideOn ? looked.dim : 0, 'preview-dim')
    if (slideOn && isVideoBackground(bg)) {
      screen.style.background = bg.color || '#000'
    } else if (slideOn && bg?.mediaPath) {
      screen.style.background = `#000 url(${bg.mediaPath}) center / cover no-repeat`
    } else if (slideOn && bg?.color) {
      screen.style.background = bg.color
    } else if (activeTheme && activeTheme.styles.backgroundColor) {
      screen.style.background = activeTheme.styles.backgroundColor
    } else {
      screen.style.background = '#000'
    }

    // Remove any previous positioned-layout overlay before re-evaluating.
    const prevOverlay = screen.querySelector('#preview-layout-overlay')
    if (prevOverlay) prevOverlay.remove()

    if (slideOn && slideLayer.content && hasLayout(slideLayer.content)) {
      // Imported layout slide: the flat PIXI text layer can't represent
      // multiple positioned boxes + images, so clear it and overlay a faithful
      // DOM layout scaled to the (16:9) preview screen.
      NativeRender.clearLayer(1)
      NativeRender.compositeLayers()

      const overlay = document.createElement('div')
      overlay.id = 'preview-layout-overlay'
      overlay.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;'
      renderSlideLayout(overlay, slideLayer.content)
      screen.appendChild(overlay)

      const messageLayer = layers.message
      if (messageLayer && messageLayer.active && messageLayer.content) {
        let msg = messageLayer.content
        if (msg.includes('{timer}')) msg = msg.replace('{timer}', state.get('timer_main') || '00:00')
        NativeRender.renderMessage(msg)
      } else {
        NativeRender.renderMessage(null)
      }

      status.textContent = 'LIVE'
      status.className = 'preview-status preview-status--live'
      screen.classList.add('preview-screen--live')
    } else if (slideOn && slideLayer.content) {
      // Base styles
      const styleOpts = {
        fontSize: 48,
        bold: true,
        hasShadow: true,
        shadowOffsetX: 4,
        shadowOffsetY: 4,
        shadowColor: 'rgba(0, 0, 0, 0.6)',
        strokeWidth: 5,
        strokeColor: '#000000',
        color: '#FFFFFF',
        fontFamily: 'Inter',
        hAlign: 'center',
        vAlign: 'center'
      }

      // Merge theme styles
      if (activeTheme && activeTheme.styles) {
        Object.assign(styleOpts, activeTheme.styles)
        // Convert textAlign to hAlign for NativeRender
        if (activeTheme.styles.textAlign) {
          styleOpts.hAlign = activeTheme.styles.textAlign
        }
      }

      // Formatting captured from the slide's own source (e.g. PPTX import)
      // takes precedence over the generic theme defaults above
      if (slideLayer.content.style) Object.assign(styleOpts, slideLayer.content.style)

      // Use the Render Engine to draw typography layout onto slide layer (index 1)
      NativeRender.renderSlideText(slideLayer.content.text || '', styleOpts)

      // Composite the active layers (Media + Slide + Props) onto composition target
      NativeRender.compositeLayers()

      // Message Layer - rendered on top of everything
      const messageLayer = layers.message
      if (messageLayer && messageLayer.active && messageLayer.content) {
        let msg = messageLayer.content
        // Replace {timer} token with actual timer value
        if (msg.includes('{timer}')) {
          msg = msg.replace('{timer}', state.get('timer_main') || '00:00')
        }
        NativeRender.renderMessage(msg)
      } else {
        NativeRender.renderMessage(null)
      }

      status.textContent = 'LIVE'
      status.className = 'preview-status preview-status--live'
      screen.classList.add('preview-screen--live')
    } else {
      // Clear the slide layer and re-composite
      NativeRender.clearLayer(1)

      // Messages are independent of the slide layer — keep them visible
      // (and cleared) even when no slide is live
      const messageLayer = layers.message
      if (messageLayer && messageLayer.active && messageLayer.content) {
        let msg = messageLayer.content
        if (msg.includes('{timer}')) {
          msg = msg.replace('{timer}', state.get('timer_main') || '00:00')
        }
        NativeRender.renderMessage(msg)
      } else {
        NativeRender.renderMessage(null)
      }

      NativeRender.compositeLayers()

      status.textContent = logoOn ? 'LOGO' : 'IDLE'
      status.className = 'preview-status'
      screen.classList.remove('preview-screen--live')
    }
  }
}
