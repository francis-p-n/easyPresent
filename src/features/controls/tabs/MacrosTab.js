import { icon } from '../../../components/common/Icons.js'

export function renderMacros(content) {
  content.innerHTML = `
    <div class="show-controls-section">
      <div class="macro-grid">
        <button class="macro-btn" data-macro="worship-look">
          <span class="macro-btn__icon" style="background: var(--bg-hover); color: var(--accent-blue);">${icon('tv', 18).outerHTML}</span>
          <span>Worship Look</span>
        </button>
        <button class="macro-btn" data-macro="sermon-look">
          <span class="macro-btn__icon" style="background: var(--bg-hover); color: var(--group-bridge);">${icon('messageSquare', 18).outerHTML}</span>
          <span>Sermon Look</span>
        </button>
        <button class="macro-btn" data-macro="clear-all">
          <span class="macro-btn__icon" style="background: var(--bg-hover); color: var(--accent-red);">${icon('x', 18).outerHTML}</span>
          <span>Clear All</span>
        </button>
        <button class="macro-btn" data-macro="pre-service">
          <span class="macro-btn__icon" style="background: var(--bg-hover); color: var(--accent-green);">${icon('clock', 18).outerHTML}</span>
          <span>Pre-Service</span>
        </button>
      </div>
    </div>
  `
}
