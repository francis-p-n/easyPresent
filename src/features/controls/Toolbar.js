import { mountRemoteButtonsEditor } from './RemoteButtonsEditor.js'
import { WORKSPACE_APPLIED_EVENT } from './WorkspaceMenu.js'
import { state } from '../../core/StateManager.js'
import { icon } from '../../components/common/Icons.js'
import { storageManager } from '../../services/StorageManager.js'
import { showToast } from '../../components/common/ToastManager.js'
import { exportSongDatabase, importSongDatabase } from '../../songs/songLibrary.js'
import { showShortcutHelp } from './ShortcutHelp.js'

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

    // Screens menu: one row per output role, each with a display picker
    const screensWrap = document.createElement('div')
    screensWrap.className = 'toolbar-presenter-only'
    screensWrap.style.position = 'relative'
    const roleRow = (role, title, hint) => `
      <div class="screens-row" data-role="${role}" style="padding:6px;display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div><strong>${title}</strong><div style="font-size:12px;opacity:.65;">${hint}</div></div>
          <button class="btn screens-toggle" data-role="${role}">Open</button>
        </div>
        <select class="input screens-display" data-role="${role}" style="width:100%;"></select>
      </div>`
    screensWrap.innerHTML = `
      <button class="btn tooltip" id="toolbar-screens-btn" data-tooltip="Screen Configuration" aria-label="Screens">
        ${icon('monitor', 16).outerHTML}<span class="toolbar-btn-label">Screens</span>
      </button>
      <div id="toolbar-screens-menu" style="display:none;position:absolute;top:calc(100% + 6px);right:0;z-index:1002;background:var(--bg-toolbar);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-md);width:290px;padding:4px;max-height:calc(100vh - 72px);overflow-y:auto;">
        <div style="padding:6px;font-size:12px;opacity:.7;line-height:1.4;">Each screen goes to its own display. "Auto" picks a free one; with a single display they open as windows you can move.</div>
        ${roleRow('audience', 'Audience', 'Congregation screen / projector')}
        ${roleRow('presenter', 'Presenter', 'Pastor: current + next slide, clock')}
        ${roleRow('pa', 'PA Team', 'Sound desk: output check, cues, timers')}
        <div style="padding:8px 6px 6px;border-top:1px solid var(--border-color);margin-top:4px;display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:12px;font-weight:600;">Audience look</div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
            <input type="checkbox" id="screens-hide-slide" /> Hide slide text on audience (stage keeps it)
          </label>
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;">
            Transition
            <select id="screens-transition" class="input" style="flex:1;">
              <option value="cut">Cut</option>
              <option value="dissolve">Dissolve</option>
              <option value="wipe">Wipe</option>
            </select>
          </div>
        </div>
        <details style="padding:8px 6px 6px;border-top:1px solid var(--border-color);margin-top:4px;">
          <summary style="font-size:12px;font-weight:600;cursor:pointer;">Remote buttons</summary>
          <div style="font-size:12px;opacity:.65;margin:4px 0;">Pick, rename, enlarge and reorder what the phone remote shows.</div>
          <div id="remote-buttons-editor"></div>
        </details>
        <div style="padding:8px 6px 6px;border-top:1px solid var(--border-color);margin-top:4px;">
          <div style="font-size:12px;font-weight:600;">Phones &amp; tablets</div>
          <div id="screens-share-note" style="font-size:12px;opacity:.65;margin:2px 0 6px;">Let people on the same Wi-Fi open the Presenter and PA screens in a web browser. Presenter and PA are view-only, but anyone on that Wi-Fi can open them. The Remote page can advance slides and needs the PIN shown here. Off until you start it.</div>
          <button class="btn" id="screens-share-btn" style="width:100%;">Start sharing</button>
          <div id="screens-share-urls" style="font-size:12px;margin-top:6px;word-break:break-all;"></div>
        </div>
      </div>`
    this.container.appendChild(screensWrap)

    // Library backup menu (export/import the whole library as .json)
    const libWrap = document.createElement('div')
    libWrap.style.position = 'relative'
    libWrap.innerHTML = `
      <button class="btn tooltip" id="toolbar-library-btn" data-tooltip="Library backup" aria-label="Library backup">
        ${icon('folder', 16).outerHTML}<span class="toolbar-btn-label">Library</span>
      </button>
      <div id="toolbar-library-menu" style="display:none;position:absolute;top:calc(100% + 6px);right:0;z-index:1002;background:var(--bg-toolbar);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-md);min-width:180px;padding:4px;">
        <button class="btn" id="library-export-btn" style="width:100%;justify-content:flex-start;border:none;">Export Library…</button>
        <button class="btn" id="library-import-btn" style="width:100%;justify-content:flex-start;border:none;">Import Library…</button>
        <div style="height:1px;background:var(--border-color);margin:4px 0;"></div>
        <button class="btn" id="songs-export-btn" style="width:100%;justify-content:flex-start;border:none;" title="Save every chord chart to a .db file you can copy to another computer">Export Songs Database…</button>
        <button class="btn" id="songs-import-btn" style="width:100%;justify-content:flex-start;border:none;" title="Merge the charts from another EasyPresent songs .db file">Import Songs Database…</button>
      </div>`
    this.container.appendChild(libWrap)

    // Keyboard shortcuts cheat sheet (also opens with the ? key)
    const helpBtn = document.createElement('button')
    helpBtn.className = 'btn tooltip toolbar-presenter-only'
    helpBtn.id = 'toolbar-help-btn'
    helpBtn.dataset.tooltip = 'Keyboard shortcuts (?)'
    helpBtn.setAttribute('aria-label', 'Keyboard shortcuts')
    helpBtn.textContent = '?'
    helpBtn.addEventListener('click', showShortcutHelp)
    this.container.appendChild(helpBtn)

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
      { key: 'audio', label: 'Audio', shortcut: 'F7' }
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

    // Audience look + transition
    const hideSlideBox = this.container.querySelector('#screens-hide-slide')
    const transitionSel = this.container.querySelector('#screens-transition')
    if (hideSlideBox) {
      hideSlideBox.checked = !!state.get('hideAudienceSlide')
      hideSlideBox.addEventListener('change', () => state.set('hideAudienceSlide', hideSlideBox.checked))
    }
    if (transitionSel) {
      transitionSel.value = state.get('outputTransition') || 'cut'
      transitionSel.addEventListener('change', () => state.set('outputTransition', transitionSel.value))
    }

    const remoteEditorHost = this.container.querySelector('#remote-buttons-editor')
    const remoteEditor = remoteEditorHost ? mountRemoteButtonsEditor(remoteEditorHost) : null
    // A saved layout can change all of these at once: redraw them from the new state
    window.addEventListener(WORKSPACE_APPLIED_EVENT, () => {
      if (hideSlideBox) hideSlideBox.checked = !!state.get('hideAudienceSlide')
      if (transitionSel) transitionSel.value = state.get('outputTransition') || 'cut'
      remoteEditor?.refresh()
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

    this.container.querySelector('#songs-export-btn')?.addEventListener('click', async () => {
      libraryMenu.style.display = 'none'
      try {
        const ok = await exportSongDatabase()
        if (ok) showToast('Songs database exported', 'success')
        else if (!window.electronAPI?.songsExport) showToast('Songs database needs the desktop app', 'error')
      } catch (err) {
        console.error('Songs export failed:', err)
        showToast('Songs export failed', 'error')
      }
    })
    this.container.querySelector('#songs-import-btn')?.addEventListener('click', async () => {
      libraryMenu.style.display = 'none'
      try {
        const count = await importSongDatabase()
        if (count != null) showToast(`Imported ${count} song${count === 1 ? '' : 's'}`, 'success')
        else if (!window.electronAPI?.songsImport) showToast('Songs database needs the desktop app', 'error')
      } catch (err) {
        console.error('Songs import failed:', err)
        showToast('Import failed — not a valid songs database', 'error')
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

    // Screens menu: open/close each role's window on a chosen display
    const screensBtn = this.container.querySelector('#toolbar-screens-btn')
    const screensMenu = this.container.querySelector('#toolbar-screens-menu')
    const openRoles = new Set()
    const syncScreens = () => {
      screensMenu.querySelectorAll('.screens-toggle').forEach((btn) => {
        const open = openRoles.has(btn.dataset.role)
        btn.textContent = open ? 'Close' : 'Open'
        btn.classList.toggle('btn--primary', open)
      })
      screensBtn.classList.toggle('active', openRoles.size > 0)
      const label = screensBtn.querySelector('.toolbar-btn-label')
      if (label) label.textContent = openRoles.size ? `Screens ${openRoles.size}/3` : 'Screens'
    }
    // "Phones & tablets": the web server only runs once someone asks for it (or opens an output window)
    const shareBtn = screensMenu.querySelector('#screens-share-btn')
    const shareUrls = screensMenu.querySelector('#screens-share-urls')
    const renderShare = (status) => {
      shareUrls.textContent = ''
      shareBtn.disabled = false
      if (!status?.sharing) {
        shareBtn.textContent = 'Start sharing'
        return
      }
      shareBtn.textContent = 'Stop sharing'
      const addresses = status.urls || []
      if (!addresses.length) shareUrls.textContent = 'No Wi-Fi/LAN connection found on this computer.'
      if (addresses.length && status.pin) {
        const pin = document.createElement('div')
        pin.id = 'screens-remote-pin'
        pin.style.cssText = 'font-weight:600;margin-bottom:4px;'
        pin.textContent = `Remote PIN: ${status.pin}`
        shareUrls.appendChild(pin)
      }
      for (const u of addresses) {
        for (const [label, href] of [['Presenter', u.presenter], ['PA', u.pa], ['Remote', u.remote]]) {
          if (!href) continue
          const line = document.createElement('div')
          line.textContent = `${label}: ${href}`
          shareUrls.appendChild(line)
        }
      }
    }
    const fillDisplays = async () => {
      const displays = (await window.electronAPI.listDisplays?.()) || []
      screensMenu.querySelectorAll('.screens-display').forEach((sel) => {
        const keep = sel.value
        sel.innerHTML =
          `<option value="">Auto (a free display, or a window)</option>` +
          displays.map((d) => `<option value="${d.id}">${d.label}</option>`).join('')
        sel.value = keep
      })
    }

    screensBtn?.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!window.electronAPI || !window.electronAPI.toggleDisplay) {
        const { showToast } = await import('../../components/common/ToastManager.js')
        showToast('Screens require the desktop app.', 'error')
        return
      }
      const opening = screensMenu.style.display === 'none'
      if (opening) {
        window.electronAPI.stageShareStatus?.().then(renderShare)
        await fillDisplays()
        openRoles.clear()
        for (const r of (await window.electronAPI.openDisplays?.()) || []) openRoles.add(r)
        syncScreens()
      }
      screensMenu.style.display = opening ? 'block' : 'none'
    })
    screensMenu?.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (e.target.closest('#screens-share-btn')) {
        const stopping = shareBtn.textContent === 'Stop sharing'
        shareBtn.disabled = true // the server restarts; don't let a second click race it
        try {
          renderShare(await (stopping ? window.electronAPI.stageShareStop() : window.electronAPI.stageShareStart()))
        } catch (err) {
          showToast(`Couldn't ${stopping ? 'stop' : 'start'} sharing: ${err.message}`, 'error')
          window.electronAPI.stageShareStatus?.().then(renderShare)
        }
        return
      }
      const btn = e.target.closest('.screens-toggle')
      if (!btn) return
      const role = btn.dataset.role
      const sel = screensMenu.querySelector(`.screens-display[data-role="${role}"]`)
      const displayId = sel && sel.value ? Number(sel.value) : undefined
      try {
        const open = await window.electronAPI.toggleDisplay(role, displayId)
        if (open) openRoles.add(role)
        else openRoles.delete(role)
        // Opening the Presenter/PA window starts the server, so show the addresses now
        window.electronAPI.stageShareStatus?.().then(renderShare)
      } catch (err) {
        showToast(err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'error')
      }
      syncScreens()
    })
    document.addEventListener('click', () => {
      if (screensMenu) screensMenu.style.display = 'none'
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
