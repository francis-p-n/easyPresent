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

    if (slideLayer.active && slideLayer.content) {
      // Use the Render Engine to draw typography layout onto slide layer (index 1)
      NativeRender.renderSlideText(slideLayer.content.text || '', {
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
      })

      // Composite the active layers (Media + Slide + Props) onto composition target
      NativeRender.compositeLayers()

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

