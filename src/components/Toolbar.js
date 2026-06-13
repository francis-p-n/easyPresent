import { state } from '../engine/StateManager.js'
import { icon } from './Icons.js'

/**
 * Toolbar — Top toolbar with view tabs, search, edit toggle, and clear buttons
 */
export class Toolbar {
  constructor(container) {
    this.container = container
    this.render()
    this._bindEvents()
  }

  render() {
    this.container.innerHTML = ''

    // App Logo
    const logo = document.createElement('div')
    logo.className = 'toolbar-logo'
    logo.innerHTML = `
      <div class="toolbar-logo__icon">EP</div>
      <span class="toolbar-logo__text">EasyPresent</span>
    `
    this.container.appendChild(logo)

    // Separator
    this.container.appendChild(this._sep())

    // View Tabs
    const viewTabs = document.createElement('div')
    viewTabs.className = 'toolbar-views'
    viewTabs.id = 'toolbar-views'

    const views = [
      { key: 'library', icon: 'library', label: 'Library' },
      { key: 'media', icon: 'media', label: 'Media' },
      { key: 'audio', icon: 'audio', label: 'Audio' },
      { key: 'bible', icon: 'bible', label: 'Bible' },
    ]

    views.forEach(v => {
      const btn = document.createElement('button')
      btn.className = `toolbar-view-btn ${state.get('activeView') === v.key ? 'active' : ''}`
      btn.dataset.view = v.key
      btn.id = `view-btn-${v.key}`
      btn.appendChild(icon(v.icon, 18))
      const lbl = document.createElement('span')
      lbl.textContent = v.label
      btn.appendChild(lbl)
      viewTabs.appendChild(btn)
    })

    this.container.appendChild(viewTabs)

    // Separator
    this.container.appendChild(this._sep())

    // Search Bar
    const searchWrap = document.createElement('div')
    searchWrap.className = 'toolbar-search'
    searchWrap.innerHTML = `<input type="text" class="input input--search" placeholder="Search presentations..." id="toolbar-search-input" />`
    this.container.appendChild(searchWrap)

    // Spacer
    const spacer = document.createElement('div')
    spacer.style.flex = '1'
    this.container.appendChild(spacer)

    // Edit Button
    const editBtn = document.createElement('button')
    editBtn.className = 'btn btn--icon tooltip'
    editBtn.id = 'toolbar-edit-btn'
    editBtn.dataset.tooltip = 'Edit Mode'
    editBtn.appendChild(icon('edit', 18))
    this.container.appendChild(editBtn)

    // Screens Button
    const screensBtn = document.createElement('button')
    screensBtn.className = 'btn btn--icon tooltip'
    screensBtn.id = 'toolbar-screens-btn'
    screensBtn.dataset.tooltip = 'Screen Configuration'
    screensBtn.appendChild(icon('monitor', 18))
    this.container.appendChild(screensBtn)

    // Separator
    this.container.appendChild(this._sep())

    // Clear Buttons
    const clearGroup = document.createElement('div')
    clearGroup.className = 'toolbar-clear-group'
    clearGroup.id = 'toolbar-clear-group'

    const clears = [
      { key: 'all', label: 'Clear All', shortcut: 'F1', cls: 'clear-btn--all' },
      { key: 'slide', label: 'Slide', shortcut: 'F2' },
      { key: 'media', label: 'Media', shortcut: 'F3' },
      { key: 'props', label: 'Props', shortcut: 'F4' },
      { key: 'audio', label: 'Audio', shortcut: 'F5' },
    ]

    clears.forEach(c => {
      const btn = document.createElement('button')
      btn.className = `clear-btn ${c.cls || ''} tooltip`
      btn.id = `clear-btn-${c.key}`
      btn.dataset.tooltip = `${c.label} (${c.shortcut})`
      btn.dataset.clearLayer = c.key
      btn.innerHTML = `<span>${c.label}</span><span class="clear-btn__shortcut">${c.shortcut}</span>`
      clearGroup.appendChild(btn)
    })

    // Logo Button
    const logoBtn = document.createElement('button')
    logoBtn.className = 'clear-btn tooltip'
    logoBtn.id = 'clear-btn-logo'
    logoBtn.dataset.tooltip = 'Show Logo (F6)'
    logoBtn.innerHTML = `${icon('logo', 16).outerHTML}<span>Logo</span><span class="clear-btn__shortcut">F6</span>`
    clearGroup.appendChild(logoBtn)

    this.container.appendChild(clearGroup)
  }

  _sep() {
    const sep = document.createElement('div')
    sep.className = 'toolbar-separator'
    return sep
  }

  _bindEvents() {
    // View tab switching
    this.container.querySelector('#toolbar-views')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.toolbar-view-btn')
      if (!btn) return
      const view = btn.dataset.view
      state.set('activeView', view)
      this.container.querySelectorAll('.toolbar-view-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
    })

    // Clear buttons
    this.container.querySelector('#toolbar-clear-group')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.clear-btn')
      if (!btn) return
      const layer = btn.dataset.clearLayer
      if (layer === 'all') {
        this._clearAll()
      } else if (layer) {
        this._clearLayer(layer)
      }
    })

    // Logo toggle
    this.container.querySelector('#clear-btn-logo')?.addEventListener('click', () => {
      const current = state.get('showLogo')
      state.set('showLogo', !current)
      this.container.querySelector('#clear-btn-logo')?.classList.toggle('active', !current)
    })

    // Search
    this.container.querySelector('#toolbar-search-input')?.addEventListener('input', (e) => {
      state.set('searchQuery', e.target.value)
    })

    // Edit toggle
    this.container.querySelector('#toolbar-edit-btn')?.addEventListener('click', () => {
      const editing = !state.get('isEditing')
      state.set('isEditing', editing)
      this.container.querySelector('#toolbar-edit-btn')?.classList.toggle('active', editing)
    })
  }

  _clearLayer(layer) {
    const layers = { ...state.get('layers') }
    if (layers[layer]) {
      layers[layer] = { active: false, content: null }
      state.set('layers', layers)
    }
    // Update visual state
    const btn = this.container.querySelector(`#clear-btn-${layer}`)
    btn?.classList.remove('active')
  }

  _clearAll() {
    const layers = state.get('layers')
    const cleared = {}
    for (const key of Object.keys(layers)) {
      cleared[key] = { active: false, content: null }
    }
    state.set('layers', cleared)
    state.set('liveSlideIndex', -1)
    // Update all button visuals
    this.container.querySelectorAll('.clear-btn:not(.clear-btn--all)').forEach(btn => {
      btn.classList.remove('active')
    })
  }
}
