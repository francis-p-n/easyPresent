import { state } from '../engine/StateManager.js'

export function createSlideEditor(container) {
  container.innerHTML = `
    <div class="slide-editor-layout" style="display: flex; height: 100%; width: 100%; background: var(--bg-panel);">
      <div class="editor-canvas-container" style="flex: 1; display: flex; align-items: center; justify-content: center; background: #000; padding: 20px; overflow: auto;">
        <div class="editor-canvas" id="editor-canvas" style="width: 1920px; height: 1080px; background: #111; position: relative; transform-origin: top left; box-shadow: 0 0 20px rgba(0,0,0,0.5);">
          <textarea id="editor-textarea" style="width: 100%; height: 100%; background: transparent; border: 2px dashed #444; color: white; font-family: Inter, sans-serif; font-size: 80px; text-align: center; resize: none; outline: none; padding: 40px; box-sizing: border-box;"></textarea>
        </div>
      </div>
      <div class="editor-properties" style="width: 300px; background: var(--bg-toolbar); border-left: 1px solid var(--border-color); padding: 15px; display: flex; flex-direction: column; gap: 15px;">
        <h3>Text Properties</h3>
        <label>
          Font Size
          <input type="number" id="prop-font-size" class="input" value="80" />
        </label>
        <label>
          Color
          <input type="color" id="prop-color" class="input" value="#ffffff" />
        </label>
        <label>
          Alignment
          <select id="prop-align" class="input">
            <option value="left">Left</option>
            <option value="center" selected>Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        
        <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 10px 0;">
        
        <h3>Presentation Settings</h3>
        <label style="display:flex; flex-direction:column; gap: 4px;">
          Rehearsal Audio Path
          <input type="text" id="prop-rehearsal-audio" class="input" placeholder="e.g. /path/to/click.mp3" />
        </label>

        <div style="margin-top: auto; display: flex; gap: 10px;">
          <button class="btn btn--primary" id="editor-save-btn" style="flex: 1;">Save</button>
          <button class="btn" id="editor-close-btn" style="flex: 1;">Close</button>
        </div>
      </div>
    </div>
  `

  const canvas = container.querySelector('#editor-canvas')
  const textarea = container.querySelector('#editor-textarea')
  const saveBtn = container.querySelector('#editor-save-btn')
  const closeBtn = container.querySelector('#editor-close-btn')
  
  const fontSizeInput = container.querySelector('#prop-font-size')
  const colorInput = container.querySelector('#prop-color')
  const alignInput = container.querySelector('#prop-align')
  const rehearsalAudioInput = container.querySelector('#prop-rehearsal-audio')

  let currentSlideIndex = -1

  function updateScale() {
    const containerWidth = canvas.parentElement.clientWidth - 40
    const containerHeight = canvas.parentElement.clientHeight - 40
    const scale = Math.min(containerWidth / 1920, containerHeight / 1080)
    canvas.style.transform = `scale(${scale})`
  }

  window.addEventListener('resize', updateScale)
  // small delay to ensure layout is done
  setTimeout(updateScale, 100)

  // Sync props to textarea
  const updateStyles = () => {
    textarea.style.fontSize = `${fontSizeInput.value}px`
    textarea.style.color = colorInput.value
    textarea.style.textAlign = alignInput.value
  }

  fontSizeInput.addEventListener('input', updateStyles)
  colorInput.addEventListener('input', updateStyles)
  alignInput.addEventListener('input', updateStyles)

  state.on('activeSlideIndex', (idx) => {
    const pres = state.get('selectedPresentation')
    if (pres && pres.slides[idx]) {
      currentSlideIndex = idx
      textarea.value = pres.slides[idx].text || ''
      rehearsalAudioInput.value = pres.linkedAudio || ''
      // If we had individual slide styles, we'd load them here
    }
  })

  saveBtn.addEventListener('click', () => {
    if (currentSlideIndex >= 0) {
      const pres = state.get('selectedPresentation')
      if (pres && pres.slides[currentSlideIndex]) {
        pres.slides[currentSlideIndex].text = textarea.value
        pres.linkedAudio = rehearsalAudioInput.value.trim()
        
        state.set('selectedPresentation', { ...pres }) // force update
        
        // Also update layers if this is the active slide
        const layers = state.get('layers')
        if (layers.slide.active && state.get('liveSlideIndex') === currentSlideIndex) {
          layers.slide.content = pres.slides[currentSlideIndex]
          state.set('layers', { ...layers })
        }
      }
    }
  })

  closeBtn.addEventListener('click', () => {
    state.set('isEditing', false)
  })

  return {
    resize: updateScale
  }
}
