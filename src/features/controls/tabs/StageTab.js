import { icon } from '../../../components/common/Icons.js'

export function renderStage(content) {
  content.innerHTML = `
    <div class="show-controls-section">
      <div class="stage-preview">
        <div class="stage-preview__label">Stage Display Preview</div>
        <div class="stage-preview__screen" id="stage-preview-screen">
          <div class="stage-preview__current">Current slide text will appear here</div>
          <div class="stage-preview__next">Next: Next slide text</div>
          <div class="stage-preview__clock" id="stage-clock">00:00:00</div>
        </div>
      </div>
      <div class="stage-controls">
        <button class="btn" id="stage-edit-layout">${icon('edit', 14).outerHTML} Edit Layout</button>
        <button class="btn btn--primary" id="stage-open-window">${icon('monitor', 14).outerHTML} Open Stage Window</button>
      </div>
    </div>
  `

  // Start clock
  const clockEl = document.getElementById('stage-clock')
  if (!clockEl) return () => {}

  const update = () => {
    const now = new Date()
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false })
  }
  update()
  const interval = setInterval(update, 1000)

  // Return cleanup
  return () => clearInterval(interval)
}
