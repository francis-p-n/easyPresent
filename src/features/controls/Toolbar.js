import { state } from '../../engine/StateManager.js'
import { icon } from '../../components/common/Icons.js'
import { storageManager } from '../../engine/StorageManager.js'
import { showToast } from '../../components/common/ToastManager.js'

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
    viewTabs.className = 'toolbar-views toolbar-presenter-only'
    viewTabs.id = 'toolbar-views'

    const views = [
      { key: 'library', icon: 'library', label: 'Library' },
      { key: 'media', icon: 'media', label: 'Media' },
      { key: 'audio', icon: 'audio', label: 'Audio' },
      { key: 'bible', icon: 'bible', label: 'Bible' }
    ]

    views.forEach((v) => {
      const btn = document.createElement('button')
      btn.className = `toolbar-view-btn ${state.get('activeView') === v.key ? 'active' : ''}`
      btn.dataset.view = v.key
      btn.id = `view-btn-${v.key}`
      btn.appendChild(icon(v.icon, 18))
      const lbl = document.createElement('span')
      lbl.className = 'toolbar-btn-label'
      lbl.textContent = v.label
      btn.appendChild(lbl)
      viewTabs.appendChild(btn)
    })

    this.container.appendChild(viewTabs)

    // Separator
    this.container.appendChild(this._sep())

    // Search Bar
    const searchWrap = document.createElement('div')
    searchWrap.className = 'toolbar-search toolbar-presenter-only'
    searchWrap.innerHTML = `<input type="text" class="input input--search" placeholder="Search..." id="toolbar-search-input" />`
    this.container.appendChild(searchWrap)

    // Spacer
    const spacer = document.createElement('div')
    spacer.style.flex = '1'
    this.container.appendChild(spacer)

    // Edit Button
    const editBtn = document.createElement('button')
    editBtn.className = 'btn tooltip'
    editBtn.id = 'toolbar-edit-btn'
    editBtn.dataset.tooltip = 'Edit Mode'
    editBtn.innerHTML = `${icon('edit', 16).outerHTML}<span class="toolbar-btn-label">Edit</span>`
    this.container.appendChild(editBtn)

    // Theme Button
    const themeBtn = document.createElement('button')
    themeBtn.className = 'btn tooltip'
    themeBtn.id = 'toolbar-theme-btn'
    themeBtn.dataset.tooltip = 'Theme Editor'
    themeBtn.innerHTML = `${icon('droplet', 16).outerHTML}<span class="toolbar-btn-label">Themes</span>`
    this.container.appendChild(themeBtn)

    // Screens Button
    const screensBtn = document.createElement('button')
    screensBtn.className = 'btn tooltip toolbar-presenter-only'
    screensBtn.id = 'toolbar-screens-btn'
    screensBtn.dataset.tooltip = 'Screen Configuration'
    screensBtn.innerHTML = `${icon('monitor', 16).outerHTML}<span class="toolbar-btn-label">Screens</span>`
    this.container.appendChild(screensBtn)

    // Library backup menu (export/import the whole library as .json)
    const libWrap = document.createElement('div')
    libWrap.style.position = 'relative'
    libWrap.innerHTML = `
      <button class="btn tooltip" id="toolbar-library-btn" data-tooltip="Library backup">
        ${icon('folder', 16).outerHTML}<span class="toolbar-btn-label">Library</span>
      </button>
      <div id="toolbar-library-menu" style="display:none;position:absolute;top:calc(100% + 6px);right:0;z-index:200;background:var(--bg-toolbar);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-md);min-width:180px;padding:4px;">
        <button class="btn" id="library-export-btn" style="width:100%;justify-content:flex-start;border:none;">Export Library…</button>
        <button class="btn" id="library-import-btn" style="width:100%;justify-content:flex-start;border:none;">Import Library…</button>
      </div>`
    this.container.appendChild(libWrap)

    // Separator (presenter-only — hidden alongside the clear group in edit mode)
    const sepBeforeClears = this._sep()
    sepBeforeClears.classList.add('toolbar-presenter-only')
    this.container.appendChild(sepBeforeClears)

    // Clear Buttons
    const clearGroup = document.createElement('div')
    clearGroup.className = 'toolbar-clear-group toolbar-presenter-only'
    clearGroup.id = 'toolbar-clear-group'

    const clears = [
      { key: 'all', label: 'Clear All', shortcut: 'F1', cls: 'clear-btn--all' },
      { key: 'slide', label: 'Slide', shortcut: 'F2' },
      { key: 'media', label: 'Media', shortcut: 'F3' },
      { key: 'props', label: 'Props', shortcut: 'F4' },
      { key: 'audio', label: 'Audio', shortcut: 'F5' }
    ]

    clears.forEach((c) => {
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
      this.container
        .querySelectorAll('.toolbar-view-btn')
        .forEach((b) => b.classList.remove('active'))
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

    // Library backup menu
    const libraryBtn = this.container.querySelector('#toolbar-library-btn')
    const libraryMenu = this.container.querySelector('#toolbar-library-menu')
    libraryBtn?.addEventListener('click', (e) => {
      e.stopPropagation()
      libraryMenu.style.display = libraryMenu.style.display === 'none' ? 'block' : 'none'
    })
    document.addEventListener('click', () => {
      if (libraryMenu) libraryMenu.style.display = 'none'
    })
    this.container.querySelector('#library-export-btn')?.addEventListener('click', async () => {
      libraryMenu.style.display = 'none'
      try {
        const ok = await storageManager.exportLibrary()
        if (ok) showToast('Library exported', 'success')
        else if (!window.electronAPI?.exportLibrary) showToast('Export needs the desktop app', 'error')
      } catch (err) {
        console.error('Library export failed:', err)
        showToast('Export failed', 'error')
      }
    })
    this.container.querySelector('#library-import-btn')?.addEventListener('click', async () => {
      libraryMenu.style.display = 'none'
      try {
        const ok = await storageManager.importLibrary()
        if (ok) showToast('Library imported', 'success')
        else if (!window.electronAPI?.importLibrary) showToast('Import needs the desktop app', 'error')
      } catch (err) {
        console.error('Library import failed:', err)
        showToast('Import failed — not a valid library file', 'error')
      }
    })

    // Edit toggle — updates label + active state, and stays in sync if
    // `isEditing` is flipped from elsewhere (e.g. switching to Bible view
    // auto-exits editing in main.js)
    const editBtn = this.container.querySelector('#toolbar-edit-btn')
    const syncEditBtn = (editing) => {
      if (!editBtn) return
      editBtn.classList.toggle('active', editing)
      editBtn.dataset.tooltip = editing ? 'Exit Editor' : 'Edit Mode'
      const label = editBtn.querySelector('.toolbar-btn-label')
      if (label) label.textContent = editing ? 'Exit Editor' : 'Edit'
    }
    editBtn?.addEventListener('click', () => {
      state.set('isEditing', !state.get('isEditing'))
    })
    state.on('isEditing', syncEditBtn)
    syncEditBtn(state.get('isEditing'))

    // Theme editor
    this.container.querySelector('#toolbar-theme-btn')?.addEventListener('click', async () => {
      const { createThemeEditor } = await import('../presentation/ThemeEditor.js')
      createThemeEditor()
    })

    // Screens: toggle the fullscreen audience output window
    this.container.querySelector('#toolbar-screens-btn')?.addEventListener('click', async () => {
      if (!window.electronAPI || !window.electronAPI.toggleAudienceOutput) {
        const { showToast } = await import('../../components/common/ToastManager.js')
        showToast('Audience output requires the desktop app.', 'error')
        return
      }
      const open = await window.electronAPI.toggleAudienceOutput()
      this.container.querySelector('#toolbar-screens-btn')?.classList.toggle('active', open)
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
    this.container.querySelectorAll('.clear-btn:not(.clear-btn--all)').forEach((btn) => {
      btn.classList.remove('active')
    })
  }
}
