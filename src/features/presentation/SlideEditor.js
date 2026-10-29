import { state } from '../../core/StateManager.js'
import { TextElement } from '../../models/TextElement.js'
import { getActiveSequence } from '../../core/arrangement.js'
import { clampAutoSeconds } from '../../core/navigation.js'
import { imageFrameStyle, shapeTransform } from '../../core/slideLayout.js'
import { BUILTIN_BACKGROUNDS } from '../../data/builtinBackgrounds.js'
import {
  captureTemplate,
  stampTemplate,
  addUserTemplate,
  removeUserTemplate,
  findUserTemplate,
  isUserTemplateKey,
  userTemplateKey,
  userTemplateId
} from '../../core/userTemplates.js'

const CANVAS_W = 1920
const CANVAS_H = 1080
const SNAP_THRESHOLD = 12 // canvas px

// 'freeform' is the escape hatch: no preset overrides, keep the slide's own
// captured font/size/color as-is. Imported PPTX slides default to this so
// their original design isn't stomped by a template.
const TEMPLATES = {
  freeform: { label: 'Freeform (no template)', fontSize: null, align: null, color: null, bg: null, maxLines: null },
  worship: { label: 'Worship', fontSize: 80, align: 'center', color: '#ffffff', bg: '#000000', maxLines: 4 },
  worship_title: { label: 'Worship — Title', fontSize: 96, align: 'center', color: '#ffffff', bg: '#000000', maxLines: 1 },
  announcement: { label: 'Announcement', fontSize: 56, align: 'left', color: '#ffffff', bg: '#1a1a2e', maxLines: 6 },
  game: { label: 'Game', fontSize: 72, align: 'center', color: '#ffff00', bg: '#1a1a1a', maxLines: 3 },
  scripture: { label: 'Scripture', fontSize: 64, align: 'center', color: '#f0e6d3', bg: '#1a1209', maxLines: 4 },
  camp: { label: 'Camp', fontSize: 80, align: 'center', color: '#ffffff', bg: '#0d1b2a', maxLines: 4 },
  blank: { label: 'Blank', fontSize: 80, align: 'center', color: '#ffffff', bg: '#000000', maxLines: 4 },
}

// Preset layouts a template can stamp onto a slide (multiple boxes)
const TEMPLATE_LAYOUTS = {
  worship: [
    { x: 96, y: 220, width: 1728, height: 640, fontSize: 80, hAlign: 'center', role: 'Lyrics' },
  ],
  worship_title: [
    { x: 96, y: 340, width: 1728, height: 280, fontSize: 110, hAlign: 'center', bold: true, role: 'Title' },
    { x: 96, y: 660, width: 1728, height: 120, fontSize: 44, hAlign: 'center', color: '#cccccc', role: 'Subtitle' },
  ],
  announcement: [
    { x: 120, y: 120, width: 1680, height: 200, fontSize: 88, hAlign: 'left', bold: true, role: 'Headline' },
    { x: 120, y: 380, width: 1680, height: 420, fontSize: 52, hAlign: 'left', role: 'Details' },
    { x: 120, y: 860, width: 1680, height: 120, fontSize: 40, hAlign: 'left', color: '#9ecbff', role: 'Time & place' },
  ],
  game: [
    { x: 96, y: 80, width: 1728, height: 180, fontSize: 90, hAlign: 'center', bold: true, color: '#ffff00', role: 'Title' },
    { x: 96, y: 320, width: 1728, height: 560, fontSize: 68, hAlign: 'center', role: 'Content' },
  ],
  scripture: [
    { x: 160, y: 200, width: 1600, height: 540, fontSize: 64, hAlign: 'center', color: '#f0e6d3', role: 'Verse' },
    { x: 160, y: 800, width: 1600, height: 100, fontSize: 40, hAlign: 'center', color: '#c9b896', italic: true, role: 'Reference' },
  ],
  camp: [
    { x: 96, y: 160, width: 1728, height: 760, fontSize: 80, hAlign: 'center', role: 'Content' },
  ],
  blank: [
    { x: 96, y: 240, width: 1728, height: 600, fontSize: 80, hAlign: 'center', role: 'Text' },
  ],
}

export function createSlideEditor(container) {
  const templateOptions = Object.entries(TEMPLATES)
    .map(([k, t]) => `<option value="${k}">${t.label}</option>`)
    .join('')

  container.innerHTML = `
    <div class="slide-editor-layout" style="display:flex;height:100%;width:100%;background:var(--bg-panel);">
      <div class="editor-canvas-container" id="editor-canvas-container" style="flex:1;display:flex;align-items:center;justify-content:center;background:#000;padding:20px;overflow:hidden;position:relative;">
        <div class="editor-canvas" id="editor-canvas" style="width:${CANVAS_W}px;height:${CANVAS_H}px;background:#111;position:absolute;transform-origin:top left;box-shadow:0 0 20px rgba(0,0,0,0.5);overflow:hidden;">
          <div id="snap-guide-v" style="position:absolute;top:0;bottom:0;width:2px;background:#e91e8c;display:none;pointer-events:none;z-index:50;"></div>
          <div id="snap-guide-h" style="position:absolute;left:0;right:0;height:2px;background:#e91e8c;display:none;pointer-events:none;z-index:50;"></div>
        </div>
        <div id="editor-hint" style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.45);font-size:12px;pointer-events:none;white-space:nowrap;">
          Click to select · Drag to move · Double-click to edit text · Arrows to nudge
        </div>
      </div>

      <div class="editor-properties" style="width:300px;background:var(--bg-toolbar);border-left:1px solid var(--border-color);padding:15px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;">
        <h3 style="margin:0;font-size:14px;color:var(--text-primary);">Slide</h3>

        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);">
          Template
          <select id="prop-template" class="input">${templateOptions}</select>
        </label>

        <div style="display:flex;gap:6px;align-items:center;">
          <input type="text" id="prop-template-name" class="input" placeholder="Name this layout" maxlength="40" style="flex:1;min-width:0;" aria-label="Template name" />
          <button class="btn" id="save-template-btn" style="font-size:12px;" title="Save this slide's boxes and background as a reusable template">Save</button>
          <button class="btn" id="delete-template-btn" style="font-size:12px;" disabled title="Delete the selected saved template">Delete</button>
        </div>

        <div style="display:flex;gap:8px;">
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);flex:1;">
            Background
            <div style="display:flex;gap:4px;align-items:center;">
              <input type="color" id="prop-bg-color" class="input" value="#000000" style="height:32px;flex:1;" />
              <button class="btn btn--icon" id="prop-bg-image-btn" title="Set background image" style="height:32px;padding:0 8px;flex-shrink:0;">&#128247;</button>
              <button class="btn btn--icon" id="prop-bg-image-clear" title="Clear background image" style="height:32px;padding:0 6px;flex-shrink:0;display:none;">&#x2715;</button>
            </div>
            <input type="file" id="prop-bg-image-file" accept="image/*" style="display:none;" />
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);flex:1;">
            Slide Type
            <select id="prop-slide-type" class="input">
              <option value="worship">Worship</option>
              <option value="announcement">Announce</option>
              <option value="game">Game</option>
              <option value="scripture">Scripture</option>
              <option value="camp">Camp</option>
              <option value="blank">Blank</option>
            </select>
          </label>
        </div>

        <div style="display:flex;gap:8px;align-items:flex-end;">
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);flex:1;">
            Auto-advance after (seconds, 0 = off)
            <input type="number" id="prop-auto-advance" class="input" min="0" max="3600" value="0" />
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary);white-space:nowrap;padding-bottom:8px;" title="When the last slide's time is up, start again from the first slide">
            <input type="checkbox" id="prop-loop" /> Loop
          </label>
        </div>

        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);">
          Transition into this slide
          <select id="prop-transition" class="input">
            <option value="">Default</option>
            <option value="cut">Cut</option>
            <option value="dissolve">Dissolve</option>
            <option value="wipe">Wipe</option>
          </select>
        </label>

        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);">
          Built-in Backgrounds
          <div id="builtin-bg-strip" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;">
            ${BUILTIN_BACKGROUNDS.map(
              (bg) => `<button class="builtin-bg-swatch" data-bg-id="${bg.id}" title="${bg.name}"
                style="flex-shrink:0;width:64px;height:36px;border-radius:4px;border:2px solid var(--border-color);cursor:pointer;padding:0;background:#000 url('${bg.dataUrl}') center / cover no-repeat;"></button>`
            ).join('')}
          </div>
        </label>

        <div style="display:flex;gap:6px;">
          <button class="btn" id="add-textbox-btn" style="flex:1;font-size:12px;">+ Text Box</button>
          <button class="btn" id="dup-textbox-btn" style="flex:1;font-size:12px;" disabled>Duplicate</button>
          <button class="btn" id="del-textbox-btn" style="font-size:12px;" disabled title="Delete box">&#x1F5D1;</button>
        </div>

        <hr style="border:0;border-top:1px solid var(--border-color);margin:0;">

        <h3 style="margin:0;font-size:14px;color:var(--text-primary);">Text Box <span id="selected-box-label" style="font-weight:400;color:var(--text-muted);font-size:12px;"></span></h3>

        <div id="box-props" style="display:flex;flex-direction:column;gap:12px;opacity:0.4;pointer-events:none;">
          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);">
            Font
            <input type="text" id="prop-font-family" class="input" list="editor-font-list" placeholder="Inter" />
            <datalist id="editor-font-list">
              <option value="Inter"></option>
              <option value="Open Sans"></option>
              <option value="Montserrat"></option>
              <option value="Arial"></option>
              <option value="Georgia"></option>
              <option value="Calibri"></option>
              <option value="Times New Roman"></option>
            </datalist>
          </label>

          <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);">
            Font Size
            <div style="display:flex;align-items:center;gap:8px;">
              <input type="number" id="prop-font-size" class="input" value="80" style="flex:1;" min="12" max="300" />
              <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;cursor:pointer;">
                <input type="checkbox" id="prop-autosize" /> Auto
              </label>
            </div>
          </label>

          <div style="display:flex;gap:8px;">
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);flex:1;">
              Color
              <input type="color" id="prop-color" class="input" value="#ffffff" style="height:32px;" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);flex:1;">
              Align
              <select id="prop-align" class="input">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>

          <div style="display:flex;gap:6px;">
            <button class="btn" id="style-bold" style="flex:1;font-weight:700;">B</button>
            <button class="btn" id="style-italic" style="flex:1;font-style:italic;">I</button>
            <select id="prop-valign" class="input" style="flex:2;">
              <option value="top">Top</option>
              <option value="center" selected>Middle</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>
        </div>

        <hr style="border:0;border-top:1px solid var(--border-color);margin:0;">

        <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-secondary);">
          Rehearsal Audio Path
          <input type="text" id="prop-rehearsal-audio" class="input" placeholder="e.g. /path/to/click.mp3" />
        </label>

        <div style="display:flex;gap:6px;">
          <button class="btn" id="editor-undo-btn" title="Undo (Ctrl+Z)" style="flex:1;font-size:12px;" disabled>&#8630; Undo</button>
          <button class="btn" id="editor-redo-btn" title="Redo (Ctrl+Shift+Z)" style="flex:1;font-size:12px;" disabled>Redo &#8631;</button>
        </div>

        <div style="margin-top:auto;display:flex;gap:10px;">
          <button class="btn btn--primary" id="editor-save-btn" style="flex:1;">Save</button>
          <button class="btn" id="editor-close-btn" style="flex:1;">Close</button>
        </div>
      </div>
    </div>
  `

  const canvasContainer = container.querySelector('#editor-canvas-container')
  const canvas = container.querySelector('#editor-canvas')
  const snapV = container.querySelector('#snap-guide-v')
  const snapH = container.querySelector('#snap-guide-h')
  const saveBtn = container.querySelector('#editor-save-btn')
  const closeBtn = container.querySelector('#editor-close-btn')
  const fontFamilyInput = container.querySelector('#prop-font-family')
  const fontSizeInput = container.querySelector('#prop-font-size')
  const autosizeCheckbox = container.querySelector('#prop-autosize')
  const colorInput = container.querySelector('#prop-color')
  const bgColorInput = container.querySelector('#prop-bg-color')
  const bgImageBtn = container.querySelector('#prop-bg-image-btn')
  const bgImageClearBtn = container.querySelector('#prop-bg-image-clear')
  const bgImageFile = container.querySelector('#prop-bg-image-file')
  let bgImageDataUrl = null
  const alignInput = container.querySelector('#prop-align')
  const valignInput = container.querySelector('#prop-valign')
  const boldBtn = container.querySelector('#style-bold')
  const italicBtn = container.querySelector('#style-italic')
  const templateSelect = container.querySelector('#prop-template')
  const templateNameInput = container.querySelector('#prop-template-name')
  const saveTemplateBtn = container.querySelector('#save-template-btn')
  const deleteTemplateBtn = container.querySelector('#delete-template-btn')
  const slideTypeSelect = container.querySelector('#prop-slide-type')
  const rehearsalAudioInput = container.querySelector('#prop-rehearsal-audio')
  const addBoxBtn = container.querySelector('#add-textbox-btn')
  const dupBoxBtn = container.querySelector('#dup-textbox-btn')
  const delBoxBtn = container.querySelector('#del-textbox-btn')
  const transitionSelect = container.querySelector('#prop-transition')
  const autoAdvanceInput = container.querySelector('#prop-auto-advance')
  const loopCheckbox = container.querySelector('#prop-loop')
  const undoBtn = container.querySelector('#editor-undo-btn')
  const redoBtn = container.querySelector('#editor-redo-btn')
  const boxProps = container.querySelector('#box-props')
  const selectedBoxLabel = container.querySelector('#selected-box-label')

  let currentSlideIndex = -1
  let elements = [] // TextElement instances for the current slide
  let images = [] // positioned image layers { id, mediaPath, x, y, width, height }
  let selectedId = null
  let scale = 1
  let editingId = null // box currently in inline text-edit mode

  // ── Undo / redo ────────────────────────────────────────────────────────────
  // Snapshots of everything the editor can change on the slide. Large strings
  // (image data URLs) are shared by reference, never copied, so 100 steps stay cheap.
  const HISTORY_LIMIT = 100
  let history = []
  let historyIdx = -1
  let checkpointTimer = null

  function takeSnapshot() {
    return {
      elements: elements.map((e) => e.toJSON()),
      images: images.map((im) => ({ ...im })),
      bgColor: bgColorInput.value,
      bgImage: bgImageDataUrl,
      templateId: templateSelect.value,
      type: slideTypeSelect.value,
      transition: transitionSelect.value,
    }
  }
  // Cheap equality key: long strings are abbreviated so a data URL isn't re-serialised each time
  const snapshotKey = (snap) =>
    JSON.stringify(snap, (k, v) =>
      typeof v === 'string' && v.length > 500 ? `${v.length}:${v.slice(0, 40)}${v.slice(-40)}` : v)

  function updateHistoryButtons() {
    undoBtn.disabled = historyIdx <= 0
    redoBtn.disabled = historyIdx >= history.length - 1
  }

  function resetHistory() {
    clearTimeout(checkpointTimer)
    checkpointTimer = null
    const snap = takeSnapshot()
    history = [{ snap, key: snapshotKey(snap) }]
    historyIdx = 0
    updateHistoryButtons()
  }

  // Records the current state as an undo step if it differs from the last one
  function checkpoint() {
    clearTimeout(checkpointTimer)
    checkpointTimer = null
    if (historyIdx < 0) return
    const snap = takeSnapshot()
    const key = snapshotKey(snap)
    if (key === history[historyIdx].key) return
    history = history.slice(0, historyIdx + 1)
    history.push({ snap, key })
    if (history.length > HISTORY_LIMIT) history.shift()
    historyIdx = history.length - 1
    updateHistoryButtons()
  }

  // Coalesces bursts (typing, colour drags, nudging) into one step
  function scheduleCheckpoint() {
    clearTimeout(checkpointTimer)
    checkpointTimer = setTimeout(checkpoint, 400)
    undoBtn.disabled = false // a pending edit is already undoable
  }

  function restoreSnapshot({ snap }) {
    stopInlineEdit()
    elements = snap.elements.map((e) => new TextElement(e))
    images = snap.images.map((im) => ({ ...im }))
    bgColorInput.value = snap.bgColor
    bgImageDataUrl = snap.bgImage
    bgImageClearBtn.style.display = bgImageDataUrl ? 'block' : 'none'
    canvas.style.background = bgImageDataUrl
      ? `${snap.bgColor} url("${bgImageDataUrl}") center / cover no-repeat`
      : snap.bgColor
    templateSelect.value = snap.templateId
    slideTypeSelect.value = snap.type
    transitionSelect.value = snap.transition || ''
    if (!findObj(selectedId)) selectedId = null
    renderBoxes()
    syncPropsPanel()
    updateHistoryButtons()
  }

  function undo() {
    checkpoint() // fold any pending edit in first so it isn't lost
    if (historyIdx <= 0) return
    historyIdx--
    restoreSnapshot(history[historyIdx])
  }

  function redo() {
    checkpoint()
    if (historyIdx >= history.length - 1) return
    historyIdx++
    restoreSnapshot(history[historyIdx])
  }

  // Selection can be a text element OR an image layer — both carry x/y/w/h.
  function findObj(id) {
    return elements.find((e) => e.id === id) || images.find((im) => im.id === id) || null
  }
  function isImageSelected() {
    return images.some((im) => im.id === selectedId)
  }

  // ── Scaling ────────────────────────────────────────────────────────────────
  function updateScale() {
    const w = canvasContainer.clientWidth - 40
    const h = canvasContainer.clientHeight - 40
    scale = Math.min(w / CANVAS_W, h / CANVAS_H)
    canvas.style.transform = `scale(${scale})`
    canvas.style.left = `${(canvasContainer.clientWidth - CANVAS_W * scale) / 2}px`
    canvas.style.top = `${(canvasContainer.clientHeight - CANVAS_H * scale) / 2}px`
  }
  window.addEventListener('resize', updateScale)
  setTimeout(updateScale, 100)

  // ── Autosize: largest font that fits the box ──────────────────────────────
  const measurer = document.createElement('div')
  measurer.style.cssText = 'position:absolute;visibility:hidden;white-space:pre-wrap;word-break:break-word;left:-99999px;top:0;line-height:1.35;'
  document.body.appendChild(measurer)

  function fitFontSize(el) {
    if (!el.text.trim()) return el.fontSize
    measurer.style.width = `${el.width}px`
    measurer.style.fontFamily = el.fontFamily || 'Inter'
    measurer.style.fontWeight = el.bold ? '700' : '400'
    measurer.textContent = el.text
    let lo = 12, hi = 300
    while (lo < hi) {
      const mid = Math.ceil((lo + hi + 1) / 2)
      measurer.style.fontSize = `${mid}px`
      if (measurer.scrollHeight <= el.height) lo = mid
      else hi = mid - 1
    }
    return Math.max(12, lo)
  }

  function applyAutosize(el) {
    if (el.textScaling === 'scaleToFit') {
      el.fontSize = fitFontSize(el)
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────────
  function boxNode(id) {
    return canvas.querySelector(`[data-box-id="${id}"]`)
  }

  // 8-point resize handles for the selected node (shared by text + image)
  function addHandles(node) {
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
    handles.forEach((dir) => {
      const h = document.createElement('div')
      h.className = 'resize-handle'
      h.dataset.dir = dir
      const pos = {
        nw: 'top:-7px;left:-7px;cursor:nwse-resize;',
        n: 'top:-7px;left:calc(50% - 6px);cursor:ns-resize;',
        ne: 'top:-7px;right:-7px;cursor:nesw-resize;',
        e: 'top:calc(50% - 6px);right:-7px;cursor:ew-resize;',
        se: 'bottom:-7px;right:-7px;cursor:nwse-resize;',
        s: 'bottom:-7px;left:calc(50% - 6px);cursor:ns-resize;',
        sw: 'bottom:-7px;left:-7px;cursor:nesw-resize;',
        w: 'top:calc(50% - 6px);left:-7px;cursor:ew-resize;',
      }[dir]
      h.style.cssText = `position:absolute;width:12px;height:12px;background:#3b82f6;border:2px solid white;border-radius:50%;z-index:20;${pos}`
      node.appendChild(h)
    })
  }

  function renderBoxes() {
    canvas.querySelectorAll('.editor-textbox, .editor-image').forEach((n) => n.remove())

    // Image layers render first so they sit behind the text boxes, matching
    // the imported slide's stacking (decorations behind, text on top).
    images.forEach((im) => {
      const node = document.createElement('div')
      node.className = 'editor-image'
      node.dataset.boxId = im.id
      const imTransform = shapeTransform(im)
      node.style.cssText = `
        position:absolute; overflow:hidden;
        left:${im.x}px; top:${im.y}px; width:${im.width}px; height:${im.height}px;
        box-sizing:border-box; cursor:move;
        border:2px ${im.id === selectedId ? 'solid #3b82f6' : 'dashed rgba(255,255,255,0.12)'};
        ${imTransform ? `transform:${imTransform};` : ''}
      `
      // Inner image framed per PPTX fillRect + srcRect crop
      const f = imageFrameStyle(im.fill, im.crop)
      const inner = document.createElement('img')
      inner.src = im.mediaPath
      inner.draggable = false
      inner.style.cssText = `position:absolute;left:${f.left}%;top:${f.top}%;width:${f.width}%;height:${f.height}%;pointer-events:none;`
      node.appendChild(inner)
      if (im.id === selectedId) addHandles(node)
      canvas.appendChild(node)
    })

    elements.forEach((el) => {
      const node = document.createElement('div')
      node.className = 'editor-textbox'
      node.dataset.boxId = el.id
      node.style.cssText = `
        position:absolute;
        left:${el.x}px; top:${el.y}px; width:${el.width}px; height:${el.height}px;
        display:flex; box-sizing:border-box; cursor:move;
        border:2px ${el.id === selectedId ? 'solid #3b82f6' : 'dashed rgba(255,255,255,0.18)'};
        align-items:${el.vAlign === 'top' ? 'flex-start' : el.vAlign === 'bottom' ? 'flex-end' : 'center'};
      `
      const textDiv = document.createElement('div')
      textDiv.className = 'editor-textbox__text'
      textDiv.style.cssText = `
        width:100%; padding:8px; outline:none;
        font-family:${el.fontFamily || 'Inter'}, sans-serif;
        font-size:${el.fontSize}px; color:${el.color};
        font-weight:${el.bold ? 700 : 400}; font-style:${el.italic ? 'italic' : 'normal'}; text-decoration:${el.underline ? 'underline' : 'none'};
        text-align:${el.hAlign}; line-height:${el.lineSpacing || 1.35};
        white-space:pre-wrap; word-break:break-word; overflow:hidden;
        ${el.hasShadow ? `text-shadow:${el.shadowOffsetX || 3}px ${el.shadowOffsetY || 3}px 6px ${el.shadowColor || 'rgba(0,0,0,0.6)'};` : ''}
      `
      textDiv.textContent = el.text
      node.appendChild(textDiv)

      // Resize handles (only on the selected box)
      if (el.id === selectedId) addHandles(node)

      canvas.appendChild(node)
    })
  }

  function syncPropsPanel() {
    // Image layers can be moved/resized/deleted but have no text properties, so
    // the text panel is only active for a selected text box.
    if (isImageSelected()) {
      const idx = images.findIndex((im) => im.id === selectedId)
      boxProps.style.opacity = '0.4'
      boxProps.style.pointerEvents = 'none'
      dupBoxBtn.disabled = false
      delBoxBtn.disabled = false
      selectedBoxLabel.textContent = `(image ${idx + 1} of ${images.length})`
      return
    }
    const el = elements.find((e) => e.id === selectedId)
    const hasSel = !!el
    boxProps.style.opacity = hasSel ? '1' : '0.4'
    boxProps.style.pointerEvents = hasSel ? 'auto' : 'none'
    dupBoxBtn.disabled = !hasSel
    delBoxBtn.disabled = !hasSel
    selectedBoxLabel.textContent = hasSel
      ? `(${elements.indexOf(el) + 1} of ${elements.length})`
      : '(none selected)'
    if (!el) return
    fontFamilyInput.value = el.fontFamily || 'Inter'
    fontSizeInput.value = Math.round(el.fontSize)
    autosizeCheckbox.checked = el.textScaling === 'scaleToFit'
    colorInput.value = el.color
    alignInput.value = el.hAlign
    valignInput.value = el.vAlign
    boldBtn.style.background = el.bold ? 'var(--accent-blue)' : ''
    italicBtn.style.background = el.italic ? 'var(--accent-blue)' : ''
  }

  function selectBox(id) {
    if (editingId && editingId !== id) stopInlineEdit()
    selectedId = id
    renderBoxes()
    syncPropsPanel()
  }

  function getSelected() {
    return findObj(selectedId)
  }

  // ── Inline text editing ────────────────────────────────────────────────────
  function startInlineEdit(id) {
    const el = elements.find((e) => e.id === id)
    const node = boxNode(id)
    if (!el || !node) return
    editingId = id
    const textDiv = node.querySelector('.editor-textbox__text')
    textDiv.contentEditable = 'plaintext-only'
    node.style.cursor = 'text'
    textDiv.focus()
    // place caret at end
    const range = document.createRange()
    range.selectNodeContents(textDiv)
    range.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)

    textDiv.onpaste = (ev) => {
      ev.preventDefault()
      const plain = ev.clipboardData.getData('text/plain')
      document.execCommand('insertText', false, plain)
    }
    textDiv.oninput = () => {
      el.text = textDiv.innerText
      if (el.textScaling === 'scaleToFit') {
        applyAutosize(el)
        textDiv.style.fontSize = `${el.fontSize}px`
        fontSizeInput.value = Math.round(el.fontSize)
      }
    }
    textDiv.onblur = () => stopInlineEdit()
  }

  function stopInlineEdit() {
    if (!editingId) return
    const node = boxNode(editingId)
    if (node) {
      const textDiv = node.querySelector('.editor-textbox__text')
      textDiv.contentEditable = 'false'
      textDiv.oninput = null
      textDiv.onblur = null
      textDiv.onpaste = null
      node.style.cursor = 'move'
    }
    editingId = null
    checkpoint()
  }

  // ── Drag & resize with snapping (rAF-throttled) ───────────────────────────
  let drag = null // { mode:'move'|'resize', dir, id, startX, startY, orig:{x,y,w,h} }
  let rafPending = false

  function showSnap(axis, pos) {
    if (axis === 'v') { snapV.style.left = `${pos}px`; snapV.style.display = 'block' }
    else { snapH.style.top = `${pos}px`; snapH.style.display = 'block' }
  }
  function hideSnaps() {
    snapV.style.display = 'none'
    snapH.style.display = 'none'
  }

  function snapValue(value, targets, axis) {
    for (const t of targets) {
      if (Math.abs(value - t) < SNAP_THRESHOLD) {
        showSnap(axis, t)
        return t
      }
    }
    return value
  }

  canvas.addEventListener('mousedown', (e) => {
    if (editingId) return // let text editing receive clicks
    const handle = e.target.closest('.resize-handle')
    const box = e.target.closest('[data-box-id]') // text box or image layer
    if (!box) {
      selectBox(null)
      return
    }
    const id = box.dataset.boxId
    if (id !== selectedId) selectBox(id)
    const el = getSelected()
    if (!el) return

    e.preventDefault()
    drag = {
      mode: handle ? 'resize' : 'move',
      dir: handle ? handle.dataset.dir : null,
      id,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      orig: { x: el.x, y: el.y, w: el.width, h: el.height },
    }
    document.body.style.userSelect = 'none'
  })

  function onDragMove(e) {
    if (!drag) return
    // Always record the latest pointer position, even between animation frames
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    if (rafPending) return
    rafPending = true
    requestAnimationFrame(() => {
      rafPending = false
      if (!drag) return
      const el = findObj(drag.id) // text element or image layer
      const node = boxNode(drag.id)
      if (!el || !node) return

      const dx = (drag.lastX - drag.startX) / scale
      const dy = (drag.lastY - drag.startY) / scale
      hideSnaps()

      if (drag.mode === 'move') {
        let nx = drag.orig.x + dx
        let ny = drag.orig.y + dy
        // Snap: box center to canvas center, edges to canvas edges
        const cx = nx + el.width / 2
        const snappedCx = snapValue(cx, [CANVAS_W / 2], 'v')
        nx += snappedCx - cx
        nx = snapValue(nx, [0, 96], 'v')
        const cy = ny + el.height / 2
        const snappedCy = snapValue(cy, [CANVAS_H / 2], 'h')
        ny += snappedCy - cy
        // Clamp inside canvas (keep at least 40px visible)
        nx = Math.max(-el.width + 40, Math.min(nx, CANVAS_W - 40))
        ny = Math.max(-el.height + 40, Math.min(ny, CANVAS_H - 40))
        el.x = Math.round(nx)
        el.y = Math.round(ny)
        node.style.left = `${el.x}px`
        node.style.top = `${el.y}px`
      } else {
        // Resize relative to original rect
        let { x, y, w, h } = { x: drag.orig.x, y: drag.orig.y, w: drag.orig.w, h: drag.orig.h }
        const dir = drag.dir
        if (dir.includes('e')) w = Math.max(80, drag.orig.w + dx)
        if (dir.includes('s')) h = Math.max(50, drag.orig.h + dy)
        if (dir.includes('w')) { w = Math.max(80, drag.orig.w - dx); x = drag.orig.x + (drag.orig.w - w) }
        if (dir.includes('n')) { h = Math.max(50, drag.orig.h - dy); y = drag.orig.y + (drag.orig.h - h) }
        el.x = Math.round(x); el.y = Math.round(y)
        el.width = Math.round(w); el.height = Math.round(h)
        node.style.left = `${el.x}px`
        node.style.top = `${el.y}px`
        node.style.width = `${el.width}px`
        node.style.height = `${el.height}px`
        if (el.textScaling === 'scaleToFit') {
          applyAutosize(el)
          const textDiv = node.querySelector('.editor-textbox__text')
          textDiv.style.fontSize = `${el.fontSize}px`
          fontSizeInput.value = Math.round(el.fontSize)
        }
      }
    })
  }

  function onDragEnd() {
    if (!drag) return
    drag = null
    hideSnaps()
    document.body.style.userSelect = ''
    checkpoint()
  }

  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)

  // Double-click → inline edit
  canvas.addEventListener('dblclick', (e) => {
    const box = e.target.closest('.editor-textbox')
    if (!box) return
    selectBox(box.dataset.boxId)
    startInlineEdit(box.dataset.boxId)
  })

  // Keyboard: nudge / delete / escape
  function onKeyDown(e) {
    if (!state.get('isEditing')) return // editor hidden — don't intercept app shortcuts
    if (editingId) {
      if (e.key === 'Escape') { e.preventDefault(); stopInlineEdit() }
      return
    }
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (k === 'y') { e.preventDefault(); redo(); return }
    }
    const el = getSelected()
    if (!el) return
    const step = e.shiftKey ? 10 : 2
    let handled = true
    switch (e.key) {
      case 'ArrowLeft': el.x -= step; break
      case 'ArrowRight': el.x += step; break
      case 'ArrowUp': el.y -= step; break
      case 'ArrowDown': el.y += step; break
      case 'Delete':
      case 'Backspace':
        elements = elements.filter((b) => b.id !== el.id)
        images = images.filter((b) => b.id !== el.id)
        selectBox(null)
        checkpoint()
        return
      case 'Escape': selectBox(null); return
      default: handled = false
    }
    if (handled) {
      e.preventDefault()
      const node = boxNode(el.id)
      if (node) { node.style.left = `${el.x}px`; node.style.top = `${el.y}px` }
      scheduleCheckpoint()
    }
  }
  document.addEventListener('keydown', onKeyDown)

  // ── Property panel bindings ────────────────────────────────────────────────
  function withSelected(fn) {
    const el = getSelected()
    if (!el) return
    fn(el)
    renderBoxes()
    syncPropsPanel()
    scheduleCheckpoint()
  }

  fontFamilyInput.addEventListener('input', () => withSelected((el) => {
    el.fontFamily = fontFamilyInput.value.trim() || 'Inter'
    if (el.textScaling === 'scaleToFit') applyAutosize(el)
  }))
  fontSizeInput.addEventListener('input', () => withSelected((el) => {
    el.fontSize = parseInt(fontSizeInput.value, 10) || el.fontSize
    el.textScaling = 'none'
    autosizeCheckbox.checked = false
  }))
  autosizeCheckbox.addEventListener('change', () => withSelected((el) => {
    el.textScaling = autosizeCheckbox.checked ? 'scaleToFit' : 'none'
    if (autosizeCheckbox.checked) applyAutosize(el)
  }))
  colorInput.addEventListener('input', () => withSelected((el) => { el.color = colorInput.value }))
  alignInput.addEventListener('change', () => withSelected((el) => { el.hAlign = alignInput.value }))
  valignInput.addEventListener('change', () => withSelected((el) => { el.vAlign = valignInput.value }))
  boldBtn.addEventListener('click', () => withSelected((el) => {
    el.bold = !el.bold
    if (el.textScaling === 'scaleToFit') applyAutosize(el)
  }))
  italicBtn.addEventListener('click', () => withSelected((el) => { el.italic = !el.italic }))
  bgColorInput.addEventListener('input', () => {
    scheduleCheckpoint()
    if (bgImageDataUrl) {
      canvas.style.background = `${bgColorInput.value} url(${bgImageDataUrl}) center / cover no-repeat`
    } else {
      canvas.style.background = bgColorInput.value
    }
  })

  bgImageBtn.addEventListener('click', () => bgImageFile.click())

  bgImageFile.addEventListener('change', () => {
    const file = bgImageFile.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      bgImageDataUrl = ev.target.result
      canvas.style.background = `${bgColorInput.value} url(${bgImageDataUrl}) center / cover no-repeat`
      bgImageClearBtn.style.display = 'block'
      checkpoint()
    }
    reader.readAsDataURL(file)
    bgImageFile.value = ''
  })

  bgImageClearBtn.addEventListener('click', () => {
    bgImageDataUrl = null
    bgImageClearBtn.style.display = 'none'
    canvas.style.background = bgColorInput.value
    checkpoint()
  })

  // Built-in background gallery — clicking a swatch applies it like an
  // uploaded image (same save path), so it syncs to every output unchanged.
  container.querySelector('#builtin-bg-strip').addEventListener('click', (e) => {
    const swatch = e.target.closest('[data-bg-id]')
    if (!swatch) return
    const bg = BUILTIN_BACKGROUNDS.find((b) => b.id === swatch.dataset.bgId)
    if (!bg) return
    bgImageDataUrl = bg.dataUrl
    canvas.style.background = `${bgColorInput.value} url("${bg.dataUrl}") center / cover no-repeat`
    bgImageClearBtn.style.display = 'block'
    checkpoint()
  })

  addBoxBtn.addEventListener('click', () => {
    const el = new TextElement({
      text: 'New text',
      x: CANVAS_W / 2 - 400, y: CANVAS_H / 2 - 100,
      width: 800, height: 200,
      fontSize: 60,
    })
    elements.push(el)
    selectBox(el.id)
    checkpoint()
  })

  dupBoxBtn.addEventListener('click', () => {
    if (isImageSelected()) {
      const im = images.find((i) => i.id === selectedId)
      if (!im) return
      const copy = { ...im, id: crypto.randomUUID(), x: im.x + 40, y: im.y + 40 }
      images.push(copy)
      selectBox(copy.id)
      checkpoint()
      return
    }
    const el = getSelected()
    if (!el) return
    const copy = new TextElement({ ...el.toJSON(), id: undefined, x: el.x + 40, y: el.y + 40 })
    elements.push(copy)
    selectBox(copy.id)
    checkpoint()
  })

  delBoxBtn.addEventListener('click', () => {
    if (!selectedId) return
    elements = elements.filter((b) => b.id !== selectedId)
    images = images.filter((b) => b.id !== selectedId)
    selectBox(null)
    checkpoint()
  })

  undoBtn.addEventListener('click', undo)
  redoBtn.addEventListener('click', redo)
  templateSelect.addEventListener('change', checkpoint)
  slideTypeSelect.addEventListener('change', checkpoint)
  transitionSelect.addEventListener('change', checkpoint)

  // Template: stamps the layout onto the slide, preserving existing text where possible
  templateSelect.addEventListener('change', () => {
    const key = templateSelect.value
    updateDeleteTemplateBtn()
    if (isUserTemplateKey(key)) {
      const saved = findUserTemplate(state.get('userTemplates'), userTemplateId(key))
      if (!saved) return
      bgColorInput.value = saved.bg
      canvas.style.background = saved.bg
      bgImageDataUrl = null
      bgImageClearBtn.style.display = 'none'
      const oldTexts = elements.map((e) => e.text).filter((s) => s.trim())
      elements = stampTemplate(saved, oldTexts).map((box) => new TextElement(box))
      selectBox(elements[0]?.id || null)
      checkpoint()
      return
    }
    const t = TEMPLATES[key]
    if (!t) return
    // Freeform is the "no-op" template — persist the choice via save() but
    // don't touch the slide's existing boxes, colors, or fonts. This is the
    // whole point of Freeform, so silently doing nothing would feel broken.
    if (key === 'freeform') return
    const layout = TEMPLATE_LAYOUTS[key]
    if (!layout) return
    bgColorInput.value = t.bg
    canvas.style.background = t.bg
    const oldTexts = elements.map((e) => e.text).filter((s) => s.trim())
    elements = layout.map((box, i) => new TextElement({
      ...box,
      color: box.color || t.color,
      text: oldTexts[i] || box.role || 'Text',
      textScaling: 'scaleToFit',
    }))
    elements.forEach(applyAutosize)
    selectBox(elements[0]?.id || null)
    checkpoint()
  })

  // ── Saved (user) templates ─────────────────────────────────────────────────
  function updateDeleteTemplateBtn() {
    deleteTemplateBtn.disabled = !isUserTemplateKey(templateSelect.value)
  }

  // Rebuilds the dropdown: built-ins first, then the operator's own layouts
  function renderTemplateOptions(keep = templateSelect.value) {
    const saved = state.get('userTemplates') || []
    templateSelect.innerHTML = templateOptions
    if (saved.length) {
      const group = document.createElement('optgroup')
      group.label = 'My templates'
      saved.forEach((t) => {
        const o = document.createElement('option')
        o.value = userTemplateKey(t.id)
        o.textContent = t.label
        group.appendChild(o)
      })
      templateSelect.appendChild(group)
    }
    // A selection that no longer exists (deleted template) falls back to Freeform
    templateSelect.value = [...templateSelect.options].some((o) => o.value === keep) ? keep : 'freeform'
    updateDeleteTemplateBtn()
  }
  renderTemplateOptions('freeform')
  const offUserTemplates = state.on('userTemplates', () => renderTemplateOptions())

  saveTemplateBtn.addEventListener('click', () => {
    const name = templateNameInput.value.trim()
    if (!name) {
      templateNameInput.focus()
      templateNameInput.placeholder = 'Type a name first'
      return
    }
    stopInlineEdit()
    const saved = captureTemplate(name, elements, bgColorInput.value)
    state.set('userTemplates', addUserTemplate(state.get('userTemplates'), saved))
    templateSelect.value = userTemplateKey(saved.id) // the slide now uses it
    templateNameInput.value = ''
    templateNameInput.placeholder = 'Name this layout'
    updateDeleteTemplateBtn()
    checkpoint()
  })

  deleteTemplateBtn.addEventListener('click', () => {
    const key = templateSelect.value
    if (!isUserTemplateKey(key)) return
    state.set('userTemplates', removeUserTemplate(state.get('userTemplates'), userTemplateId(key)))
  })

  // ── Load slide into editor ─────────────────────────────────────────────────
  // `sequenceIdx` is a position in the active ARRANGEMENT (see arrangement.js),
  // which can repeat a slide — resolve it back to the slide's real position in
  // pres.slides, since that's what edits and saves must target.
  function loadSlide(sequenceIdx) {
    const pres = state.get('selectedPresentation')
    const sequenceSlide = pres && getActiveSequence(pres)[sequenceIdx]
    const idx = sequenceSlide ? pres.slides.findIndex((s) => s.id === sequenceSlide.id) : -1
    if (idx === -1) return
    stopInlineEdit()
    currentSlideIndex = idx
    const slide = pres.slides[idx]
    rehearsalAudioInput.value = pres.linkedAudio || ''
    transitionSelect.value = slide.transition || ''
    autoAdvanceInput.value = clampAutoSeconds(slide.autoAdvanceSec)
    loopCheckbox.checked = !!pres.loop
    if (slide.type && [...slideTypeSelect.options].some((o) => o.value === slide.type)) {
      slideTypeSelect.value = slide.type
    }

    // Prefer explicit templateId, then a template matching the slide's type,
    // then Freeform (no overrides). Imported slides land here as 'imported' —
    // Freeform keeps their captured font/color/bg instead of resetting them.
    const savedTemplate = isUserTemplateKey(slide.templateId)
      ? findUserTemplate(state.get('userTemplates'), userTemplateId(slide.templateId))
      : null
    const t =
      TEMPLATES[slide.templateId] || (savedTemplate && { bg: savedTemplate.bg }) || TEMPLATES[slide.type] || TEMPLATES.freeform
    templateSelect.value = TEMPLATES[slide.templateId] || savedTemplate
      ? slide.templateId
      : TEMPLATES[slide.type]
        ? slide.type
        : 'freeform'
    updateDeleteTemplateBtn()
    const bg = (slide.background && slide.background.color) || t.bg || '#000000'
    bgColorInput.value = bg
    // Show the imported background media (usually a PPTX design image) in
    // the editor canvas so the operator can see what they're editing over.
    // Without this the canvas showed only the fill color and imported
    // backgrounds looked "lost" the moment the slide was opened for editing.
    const bgMediaPath =
      slide.background &&
      slide.background.type === 'media' &&
      slide.background.mediaPath
        ? slide.background.mediaPath
        : null
    bgImageDataUrl = bgMediaPath || null
    bgImageClearBtn.style.display = bgImageDataUrl ? 'block' : 'none'
    if (bgImageDataUrl) {
      canvas.style.background = `${bg} url(${bgImageDataUrl}) center / cover no-repeat`
    } else {
      canvas.style.background = bg
    }

    // Positioned image layers (imported PPTX decorations) — shown behind the
    // text boxes so the operator edits over the real layout.
    images = Array.isArray(slide.images) ? slide.images.map((im) => ({ ...im })) : []

    if (Array.isArray(slide.elements) && slide.elements.length > 0) {
      elements = slide.elements.map((e) => new TextElement(e))
    } else {
      // Legacy slide: single text field → one full-width box. Imported PPTX
      // slides land here (they carry `slide.style`, not `slide.elements`) —
      // honor that captured style instead of silently resetting to the
      // generic template look the moment the slide is opened for editing.
      const importedStyle = slide.style || {}
      elements = [
        new TextElement({
          text: slide.text || '',
          x: 96, y: 190, width: CANVAS_W - 192, height: CANVAS_H - 380,
          fontSize: importedStyle.fontSize || t.fontSize || 80,
          fontFamily: importedStyle.fontFamily,
          color: importedStyle.color || t.color || '#ffffff',
          hAlign: importedStyle.hAlign || t.align || 'center',
          vAlign: importedStyle.vAlign,
          bold: importedStyle.bold,
          italic: importedStyle.italic,
          underline: importedStyle.underline,
          lineSpacing: importedStyle.lineSpacing,
          textScaling: 'scaleToFit',
        }),
      ]
      elements.forEach(applyAutosize)
    }
    selectBox(elements[0]?.id || null)
    resetHistory()
  }

  state.on('activeSlideIndex', loadSlide)

  // ── Save ───────────────────────────────────────────────────────────────────
  saveBtn.addEventListener('click', () => {
    stopInlineEdit()
    if (currentSlideIndex < 0) return
    const pres = state.get('selectedPresentation')
    if (!pres || !pres.slides[currentSlideIndex]) return

    const updated = state.updatePresentation(pres.id, (p) => {
      const slide = p.slides[currentSlideIndex]
      slide.elements = elements.map((e) => e.toJSON())
      slide.images = images.map((im) => ({ ...im }))
      // Keep plain text in sync so thumbnails, search, and stage display still work
      slide.text = elements.map((e) => e.text).filter((s) => s.trim()).join('\n')
      slide.type = slideTypeSelect.value
      slide.templateId = templateSelect.value
      if (transitionSelect.value) slide.transition = transitionSelect.value
      else delete slide.transition
      const auto = clampAutoSeconds(autoAdvanceInput.value)
      if (auto) slide.autoAdvanceSec = auto
      else delete slide.autoAdvanceSec
      if (loopCheckbox.checked) p.loop = true
      else delete p.loop
      // Preserve the existing background type + mediaPath (e.g. an imported
      // PPTX background image). Previously this forced type: 'color', which
      // silently dropped the imported bg image the first time the operator
      // saved an edit — the slide would go from a themed design to a plain
      // color background with no warning.
      // bgImageDataUrl is the single source of truth for the bg image: it is
      // seeded from the slide on load, replaced on upload, and nulled by the
      // clear button — so falling back to prevBg.mediaPath here would silently
      // resurrect an image the operator just cleared.
      const prevBg = slide.background || {}
      const mediaPath = bgImageDataUrl || null
      slide.background = {
        ...prevBg,
        type: mediaPath ? 'media' : 'color',
        color: bgColorInput.value,
        mediaPath: mediaPath || undefined,
      }
      p.linkedAudio = rehearsalAudioInput.value.trim()
    })

    // Compare by slide identity, not liveSlideIndex — an arrangement can put
    // this same slide at a different position than its master index
    const layers = state.get('layers')
    const editedId = pres.slides[currentSlideIndex].id
    if (updated && layers.slide.active && layers.slide.content?.id === editedId) {
      layers.slide.content = updated.slides[currentSlideIndex]
      state.set('layers', { ...layers })
    }
  })

  closeBtn.addEventListener('click', () => {
    stopInlineEdit()
    state.set('isEditing', false)
  })

  return {
    resize: updateScale,
    destroy() {
      document.removeEventListener('mousemove', onDragMove)
      document.removeEventListener('mouseup', onDragEnd)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', updateScale)
      clearTimeout(checkpointTimer)
      offUserTemplates()
      measurer.remove()
    },
  }
}
