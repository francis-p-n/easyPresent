// NativeRender.js - Handles GPU-accelerated compositing, typography layout, and transitions
// Automatically falls back to HTML5 Canvas if the native C++ addon (.node module) is not compiled.

let nativeEngine = null;

try {
  // Attempt to load the compiled C++ module in Electron environment
  if (typeof window !== 'undefined' && window.require) {
    nativeEngine = window.require('./build/Release/propresenter_render.node');
  } else if (typeof require !== 'undefined') {
    nativeEngine = require('../../build/Release/propresenter_render.node');
  }
} catch (e) {
  // Silently catch - this is expected when VS Build Tools aren't installed yet
}

class NativeRender {
  constructor(width = 1920, height = 1080) {
    this.width = width;
    this.height = height;
    this.useNative = false;

    // If native addon exists, load it
    if (nativeEngine && nativeEngine.RenderEngine) {
      try {
        this.engine = new nativeEngine.RenderEngine(width, height);
        this.useNative = this.engine.initialize();
      } catch (err) {
        console.warn("Failed to initialize native DirectX 11 engine. Falling back to Canvas.", err);
      }
    }

    // If native engine failed or wasn't loaded, set up Canvas 2D fallback
    if (!this.useNative) {
      this.initCanvasFallback();
    }
  }

  initCanvasFallback() {
    this.canvasLayers = [];
    this.canvasContexts = [];
    
    // Create layer canvases
    // Layers: 0: Media, 1: Slide, 2: Props, 3: Announcement
    for (let i = 0; i < 4; i++) {
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        this.canvasLayers[i] = canvas;
        this.canvasContexts[i] = canvas.getContext('2d');
      } else {
        this.canvasLayers[i] = null;
        this.canvasContexts[i] = null;
      }
    }

    // Create composition target canvas
    if (typeof document !== 'undefined') {
      const compCanvas = document.createElement('canvas');
      compCanvas.width = this.width;
      compCanvas.height = this.height;
      this.compositeCanvas = compCanvas;
      this.compositeContext = compCanvas.getContext('2d');
    } else {
      this.compositeCanvas = null;
      this.compositeContext = null;
    }
  }

  // --- JS Wrapper methods matching the N-API C++ interface ---

  updateLayerTexture(layerIndex, pixelsBuffer, width, height) {
    if (this.useNative) {
      return this.engine.updateLayerTexture(layerIndex, pixelsBuffer, width, height);
    }

    const ctx = this.canvasContexts[layerIndex];
    if (!ctx) return false;

    // Convert raw BGRA pixel array buffer into ImageData for Canvas 2D context
    const imgData = ctx.createImageData(width, height);
    // BGRA -> RGBA conversion for HTML5 canvas compatibility
    for (let i = 0; i < pixelsBuffer.length; i += 4) {
      imgData.data[i]     = pixelsBuffer[i + 2]; // Red
      imgData.data[i + 1] = pixelsBuffer[i + 1]; // Green
      imgData.data[i + 2] = pixelsBuffer[i];     // Blue
      imgData.data[i + 3] = pixelsBuffer[i + 3]; // Alpha
    }
    ctx.putImageData(imgData, 0, 0);
    return true;
  }

  setBackgroundColor(color) {
    this.backgroundColor = color;
  }

  compositeLayers() {
    if (this.useNative) {
      // For native, we could pass it or handle it in C++, but for now we rely on Canvas fallback for web
      return this.engine.compositeLayers();
    }

    const ctx = this.compositeContext;
    if (!ctx) return false;

    // 1. Draw solid backdrop
    ctx.fillStyle = this.backgroundColor || '#000000';
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Blend layers in chronological order: Media -> Slide -> Props -> Announcement
    for (let i = 0; i < 4; i++) {
      const layerCanvas = this.canvasLayers[i];
      if (layerCanvas) {
        ctx.drawImage(layerCanvas, 0, 0);
      }
    }
    return true;
  }

  readCompositePixels() {
    if (this.useNative) {
      return this.engine.readCompositePixels();
    }

    const ctx = this.compositeContext;
    if (!ctx) return new Uint8Array(this.width * this.height * 4);

    const imgData = ctx.getImageData(0, 0, this.width, this.height);
    const rgba = imgData.data;
    const bgra = new Uint8Array(rgba.length);

    // Convert RGBA -> BGRA to match raw texture pixel buffer layouts
    for (let i = 0; i < rgba.length; i += 4) {
      bgra[i]     = rgba[i + 2]; // Blue
      bgra[i + 1] = rgba[i + 1]; // Green
      bgra[i + 2] = rgba[i];     // Red
      bgra[i + 3] = rgba[i + 3]; // Alpha
    }
    return bgra;
  }

  clearLayer(layerIndex) {
    if (this.useNative) {
      return this.engine.clearLayer(layerIndex);
    }

    const ctx = this.canvasContexts[layerIndex];
    if (!ctx) return false;

    ctx.clearRect(0, 0, this.width, this.height);
    return true;
  }

  getSharedTextureHandle(layerIndex) {
    if (this.useNative) {
      return this.engine.getSharedTextureHandle(layerIndex);
    }
    return 0; // Returns null pointer reference if not compiled natively
  }

  setTransition(type, duration) {
    if (this.useNative) {
      return this.engine.setTransition(type, duration);
    }
    this.transitionType = type;
    this.transitionDuration = duration;
    return true;
  }

  // --- High-level Utility Render Helpers (for UI display and preview rendering) ---

  /**
   * Renders typography onto the Slide layer matching DirectWrite layout rules.
   * @param {string} slideText The text string to render.
   * @param {object} style Formatting rules: font size, alignments, outline styles, and drop shadows.
   */
  renderSlideText(slideText, style = {}) {
    const defaultStyle = {
      fontFamily: 'Inter',
      fontSize: 60,
      color: '#FFFFFF',
      bold: false,
      italic: false,
      underline: false,
      strokeWidth: 0,
      strokeColor: '#000000',
      hasShadow: false,
      shadowOffsetX: 3,
      shadowOffsetY: 3,
      shadowColor: 'rgba(0, 0, 0, 0.5)',
      hAlign: 'center', // left, center, right
      vAlign: 'center', // top, center, bottom
      x: 0,
      y: 0,
      w: this.width,
      h: this.height
    };

    const s = { ...defaultStyle, ...style };

    const ctx = this.canvasContexts[1]; // Slide layer is index 1
    if (!ctx) return;

    // Clear bounds
    ctx.clearRect(s.x, s.y, s.w, s.h);

    if (!slideText) return;

    // Apply fonts
    let fontStr = '';
    if (s.italic) fontStr += 'italic ';
    if (s.bold) fontStr += 'bold ';
    fontStr += `${s.fontSize}px "${s.fontFamily}"`;
    ctx.font = fontStr;

    // Apply alignments
    ctx.textAlign = s.hAlign;
    ctx.textBaseline = s.vAlign === 'center' ? 'middle' : s.vAlign;

    // Find center coordinate positions
    let tx = s.x;
    if (s.hAlign === 'center') tx += s.w / 2;
    else if (s.hAlign === 'right') tx += s.w;

    let ty = s.y;
    if (s.vAlign === 'center') ty += s.h / 2;
    else if (s.vAlign === 'bottom') ty += s.h;

    // Multiline layout calculations
    const lines = slideText.split('\n');
    const lineHeight = s.fontSize * 1.35;
    const totalHeight = lines.length * lineHeight;
    let startY = ty;

    if (s.vAlign === 'center') {
      startY = ty - (totalHeight / 2) + (lineHeight / 2);
    } else if (s.vAlign === 'bottom') {
      startY = ty - totalHeight + lineHeight;
    }

    const drawLine = (line, lx, ly) => {
      // 1. Draw Drop Shadow
      if (s.hasShadow) {
        ctx.fillStyle = s.shadowColor;
        ctx.fillText(line, lx + s.shadowOffsetX, ly + s.shadowOffsetY);
      }

      // 2. Draw outline stroke
      if (s.strokeWidth > 0) {
        ctx.strokeStyle = s.strokeColor;
        ctx.lineWidth = s.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, lx, ly);
      }

      // 3. Draw fill text
      ctx.fillStyle = s.color;
      ctx.fillText(line, lx, ly);

      // 4. Draw Underline
      if (s.underline) {
        const textMetrics = ctx.measureText(line);
        const textWidth = textMetrics.width;
        let ux = lx;
        if (s.hAlign === 'center') ux = lx - textWidth / 2;
        else if (s.hAlign === 'right') ux = lx - textWidth;

        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(1.5, s.fontSize / 15);
        ctx.beginPath();
        ctx.moveTo(ux, ly + (s.fontSize / 3));
        ctx.lineTo(ux + textWidth, ly + (s.fontSize / 3));
        ctx.stroke();
      }
    };

    lines.forEach((line, idx) => {
      drawLine(line, tx, startY + (idx * lineHeight));
    });

    // Fire event for local updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('native-layer-updated', { detail: { layer: 1 } }));
    }
  }

  // Returns data URL of composite canvas (for preview windows and thumbnail previews)
  getCompositeDataUrl() {
    if (this.compositeCanvas) {
      this.compositeLayers();
      return this.compositeCanvas.toDataURL('image/png');
    }
    return '';
  }

  /**
   * Generates a 16:9 thumbnail image data URL for a slide text layout.
   * Uses a reused offscreen canvas at 480x270 for optimal memory and rendering performance.
   */
  generateThumbnailDataUrl(slideText, style = {}) {
    if (typeof document === 'undefined') return '';

    if (!this.thumbCanvas) {
      this.thumbCanvas = document.createElement('canvas');
      this.thumbCanvas.width = 480;
      this.thumbCanvas.height = 270;
      this.thumbContext = this.thumbCanvas.getContext('2d');
    }

    const ctx = this.thumbContext;
    const w = this.thumbCanvas.width;
    const h = this.thumbCanvas.height;

    // Clear and draw solid dark backdrop
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = style.backgroundColor || '#0f1115'; // Darker theme color matching slide panels
    ctx.fillRect(0, 0, w, h);

    if (!slideText) {
      return this.thumbCanvas.toDataURL('image/jpeg', 0.85);
    }

    // Scale formatting parameters down proportionally
    const scale = w / this.width; // 480 / 1920 = 0.25
    const fontSize = (style.fontSize || 60) * scale;
    const strokeWidth = (style.strokeWidth || 0) * scale;
    const shadowOffsetX = (style.shadowOffsetX || 3) * scale;
    const shadowOffsetY = (style.shadowOffsetY || 3) * scale;

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
    };


    // Apply font settings
    let fontStr = '';
    if (s.italic) fontStr += 'italic ';
    if (s.bold) fontStr += 'bold ';
    fontStr += `${s.fontSize}px "${s.fontFamily}"`;
    ctx.font = fontStr;

    ctx.textAlign = s.hAlign;
    ctx.textBaseline = s.vAlign === 'center' ? 'middle' : s.vAlign;

    let tx = s.x;
    if (s.hAlign === 'center') tx += s.w / 2;
    else if (s.hAlign === 'right') tx += s.w;

    let ty = s.y;
    if (s.vAlign === 'center') ty += s.h / 2;
    else if (s.vAlign === 'bottom') ty += s.h;

    const lines = slideText.split('\n');
    const lineHeight = s.fontSize * 1.35;
    const totalHeight = lines.length * lineHeight;
    let startY = ty;

    if (s.vAlign === 'center') {
      startY = ty - (totalHeight / 2) + (lineHeight / 2);
    } else if (s.vAlign === 'bottom') {
      startY = ty - totalHeight + lineHeight;
    }

    lines.forEach((line, idx) => {
      const ly = startY + (idx * lineHeight);

      // Draw drop shadow
      if (s.hasShadow) {
        ctx.fillStyle = s.shadowColor;
        ctx.fillText(line, tx + s.shadowOffsetX, ly + s.shadowOffsetY);
      }

      // Draw outline stroke
      if (s.strokeWidth > 0) {
        ctx.strokeStyle = s.strokeColor;
        ctx.lineWidth = s.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, tx, ly);
      }

      // Draw fill
      ctx.fillStyle = s.color;
      ctx.fillText(line, tx, ly);
    });

    return this.thumbCanvas.toDataURL('image/jpeg', 0.85);
  }
}

export default new NativeRender();

