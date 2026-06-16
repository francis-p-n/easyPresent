import { icon } from '../../../components/common/Icons.js'

export function renderProps(content) {
  content.innerHTML = `
    <div class="show-controls-section">
      <div class="empty-state">
        ${icon('layers', 48).outerHTML}
        <div class="empty-state__text" style="margin-bottom: var(--spacing-sm);">No props configured<br>Add logos, lower thirds, and overlays</div>
        <button class="btn btn--primary">${icon('plus', 14).outerHTML} Add Prop</button>
      </div>
    </div>
  `
}
