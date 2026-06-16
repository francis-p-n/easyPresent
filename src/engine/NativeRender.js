import * as PIXI from 'pixi.js'

class NativeRender {
  constructor(width = 1920, height = 1080) {
    this.width = width
    this.height = height

    // Create canvas synchronously so PreviewPanel can append it immediately
    if (typeof document !== 'undefined') {
      this.compositeCanvas = document.createElement('canvas')
      this.compositeCanvas.width = this.width
      this.compositeCanvas.height = this.height
    } else {
      this.compositeCanvas = null
    }

    this.pixiApp = new PIXI.Application()
    this.ready = false
    this.layers = []

    if (this.compositeCanvas) {
      this.pixiApp
        .init({
          canvas: this.compositeCanvas,
          width: this.width,
          height: this.height,
          backgroundColor: '#000000',
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
          clearBeforeRender: true
        })
        .then(() => {
          this.ready = true
          // Layers: 0: Media, 1: Slide, 2: Props, 3: Announcement
          for (let i = 0; i < 4; i++) {
            const layer = new PIXI.Container()
            this.layers.push(layer)
            this.pixiApp.stage.addChild(layer)
          }
        })
    }
  }

  updateLayerTexture(layerIndex, pixelsBuffer, width, height) {
    if (!this.ready || !this.layers[layerIndex]) return false
    // Implementation for mapping raw buffers to PIXI.Texture would go here
    return true
  }

  setBackgroundColor(color) {
    if (this.ready) {
      this.pixiApp.renderer.background.color = color
    }
  }

  compositeLayers() {
    // PixiJS handles compositing automatically on its ticker
    return true
  }

  clearLayer(layerIndex) {
    if (this.ready && this.layers[layerIndex]) {
      this.layers[layerIndex].removeChildren()
    }
    return true
  }

  renderSlideText(slideText, style = {}) {
    if (!this.ready) return
    const layer = this.layers[1] // Slide layer is index 1
    layer.removeChildren()

    if (!slideText) return

    const textStyle = new PIXI.TextStyle({
      fontFamily: style.fontFamily || 'Inter',
      fontSize: style.fontSize || 60,
      fill: style.color || '#FFFFFF',
      fontWeight: style.bold ? 'bold' : 'normal',
      fontStyle: style.italic ? 'italic' : 'normal',
      stroke: { color: style.strokeColor || '#000000', width: style.strokeWidth || 0 },
      dropShadow: style.hasShadow
        ? {
            color: style.shadowColor || 'rgba(0,0,0,0.5)',
            blur: 4,
            distance: Math.sqrt((style.shadowOffsetX || 3) ** 2 + (style.shadowOffsetY || 3) ** 2)
          }
        : undefined,
      align: style.hAlign === 'center' ? 'center' : style.hAlign === 'right' ? 'right' : 'left',
      wordWrap: true,
      wordWrapWidth: this.width - 100
    })

    const text = new PIXI.Text({ text: slideText, style: textStyle })

    // Find coordinate positions
    let tx = style.x || 0
    if (style.hAlign === 'center') tx += (style.w || this.width) / 2 - text.width / 2
    else if (style.hAlign === 'right') tx += (style.w || this.width) - text.width

    let ty = style.y || 0
    if (style.vAlign === 'center') ty += (style.h || this.height) / 2 - text.height / 2
    else if (style.vAlign === 'bottom') ty += (style.h || this.height) - text.height

    text.x = tx
    text.y = ty

    layer.addChild(text)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('native-layer-updated', { detail: { layer: 1 } }))
    }
  }

  getCompositeDataUrl() {
    if (this.compositeCanvas) {
      return this.compositeCanvas.toDataURL('image/png')
    }
    return ''
  }

  generateThumbnailDataUrl(slideText, style = {}) {
    if (typeof document === 'undefined') return ''

    if (!this.thumbCanvas) {
      this.thumbCanvas = document.createElement('canvas')
      this.thumbCanvas.width = 480
      this.thumbCanvas.height = 270
      this.thumbContext = this.thumbCanvas.getContext('2d')
    }

    const ctx = this.thumbContext
    const w = this.thumbCanvas.width
    const h = this.thumbCanvas.height

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = style.backgroundColor || '#0f1115'
    ctx.fillRect(0, 0, w, h)

    if (!slideText) {
      return this.thumbCanvas.toDataURL('image/jpeg', 0.85)
    }

    const scale = w / this.width
    const fontSize = (style.fontSize || 60) * scale
    const strokeWidth = (style.strokeWidth || 0) * scale
    const shadowOffsetX = (style.shadowOffsetX || 3) * scale
    const shadowOffsetY = (style.shadowOffsetY || 3) * scale

    const s = {
      fontFamily: 'Inter',
      color: '#FFFFFF',
      bold: true,
      italic: false,
      underline: false,
      strokeColor: '#000000',
      hasShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.6)',
      hAlign: 'center',
      vAlign: 'center',
      ...style,
      fontSize,
      strokeWidth,
      shadowOffsetX,
      shadowOffsetY,
      x: 0,
      y: 0,
      w,
      h
    }

    let fontStr = ''
    if (s.italic) fontStr += 'italic '
    if (s.bold) fontStr += 'bold '
    fontStr += `${s.fontSize}px "${s.fontFamily}"`
    ctx.font = fontStr

    ctx.textAlign = s.hAlign
    ctx.textBaseline = s.vAlign === 'center' ? 'middle' : s.vAlign

    let tx = s.x
    if (s.hAlign === 'center') tx += s.w / 2
    else if (s.hAlign === 'right') tx += s.w

    let ty = s.y
    if (s.vAlign === 'center') ty += s.h / 2
    else if (s.vAlign === 'bottom') ty += s.h

    const lines = slideText.split('\n')
    const lineHeight = s.fontSize * 1.35
    const totalHeight = lines.length * lineHeight
    let startY = ty

    if (s.vAlign === 'center') {
      startY = ty - totalHeight / 2 + lineHeight / 2
    } else if (s.vAlign === 'bottom') {
      startY = ty - totalHeight + lineHeight
    }

    lines.forEach((line, idx) => {
      const ly = startY + idx * lineHeight
      if (s.hasShadow) {
        ctx.fillStyle = s.shadowColor
        ctx.fillText(line, tx + s.shadowOffsetX, ly + s.shadowOffsetY)
      }
      if (s.strokeWidth > 0) {
        ctx.strokeStyle = s.strokeColor
        ctx.lineWidth = s.strokeWidth
        ctx.lineJoin = 'round'
        ctx.strokeText(line, tx, ly)
      }
      ctx.fillStyle = s.color
      ctx.fillText(line, tx, ly)
    })

    return this.thumbCanvas.toDataURL('image/jpeg', 0.85)
  }
}

export default new NativeRender()
