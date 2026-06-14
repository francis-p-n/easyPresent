import { state } from '../engine/StateManager.js'
import NativeRender from '../engine/NativeRender.js'

/**
 * PreviewPanel — Shows live output preview using the NativeRender engine
 */
export class PreviewPanel {
  constructor(container) {
    this.container = container
    this.render()

    state.on('layers', () => this._updatePreview())
    state.on('liveSlideIndex', () => this._updatePreview())
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
    
    const activeThemeId = state.get('activeThemeId')
    const themes = state.get('themes') || []
    const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0]

    // Set background
    if (activeTheme && activeTheme.styles.backgroundColor) {
      NativeRender.setBackgroundColor(activeTheme.styles.backgroundColor)
    }

    if (slideLayer.active && slideLayer.content) {
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

      // Use the Render Engine to draw typography layout onto slide layer (index 1)
      NativeRender.renderSlideText(slideLayer.content.text || '', styleOpts)

      // Composite the active layers (Media + Slide + Props) onto composition target
      NativeRender.compositeLayers()

      // Message Layer - rendered on top of everything
      const messageLayer = layers.message
      if (messageLayer && messageLayer.active && messageLayer.content) {
        // We'll draw the message directly to the preview canvas or ask NativeRender to do it
        const ctx = NativeRender.previewCtx || NativeRender.ctx
        if (ctx) {
          let msg = messageLayer.content
          // Replace {timer} token with actual timer value
          if (msg.includes('{timer}')) {
            msg = msg.replace('{timer}', state.get('timer_main') || '00:00')
          }
          
          ctx.save()
          ctx.font = 'bold 32px Inter, sans-serif'
          ctx.fillStyle = '#000000'
          const padding = 10
          const textMetrics = ctx.measureText(msg)
          const width = textMetrics.width + padding * 2
          const height = 40 + padding * 2
          const x = (ctx.canvas.width - width) / 2
          const y = ctx.canvas.height - height - 40
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
          ctx.fillRect(x, y, width, height)
          
          ctx.fillStyle = '#ffffff'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(msg, ctx.canvas.width / 2, y + height / 2)
          ctx.restore()
        }
      }

      status.textContent = 'LIVE'
      status.className = 'preview-status preview-status--live'
      screen.classList.add('preview-screen--live')
    } else {
      // Clear the slide layer and re-composite
      NativeRender.clearLayer(1)
      NativeRender.compositeLayers()

      status.textContent = 'IDLE'
      status.className = 'preview-status'
      screen.classList.remove('preview-screen--live')
    }
  }
}

