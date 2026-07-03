import { state } from '../../engine/StateManager.js'
import { icon } from '../../components/common/Icons.js'
import { createSongImporter } from './SongImporter.js'
import { showToast } from '../../components/common/ToastManager.js'
import { CAMP_TEMPLATE_SETS } from './CampTemplates.js'

/**
 * LibraryPanel — Left panel showing presentation library with folders
 */
export class LibraryPanel {
  constructor(container) {
    this.container = container
    this.render()
    this._bindEvents()

    // Re-render when search changes
    state.on('searchQuery', () => this._renderList())
  }

  render() {
    this.container.innerHTML = ''

    // Header
    const header = document.createElement('div')
    header.className = 'panel-header'
    header.innerHTML = `
      <span class="panel-header__title">Library</span>
      <div class="panel-header__actions">
        <button class="btn btn--icon" id="library-import-pptx-btn" title="Import PPTX">
          ${icon('upload', 14).outerHTML}
        </button>
        <button class="btn btn--icon" id="library-add-song-btn" title="New Song">
          ${icon('music', 14).outerHTML}
        </button>
        <button class="btn btn--icon" id="library-template-btn" title="New from Template">
          ${icon('layoutTemplate', 14).outerHTML}
        </button>
        <button class="btn" id="library-add-btn" title="New Presentation">
          ${icon('plus', 14).outerHTML} New
        </button>
        <button class="btn btn--icon" id="library-folder-btn" title="New Folder">
          ${icon('folder', 14).outerHTML}
        </button>
      </div>
    `
    this.container.appendChild(header)

    // Category Tabs
    const catTabs = document.createElement('div')
    catTabs.className = 'library-categories'
    catTabs.id = 'library-categories'

    const categories = ['All', ...new Set(state.get('presentations').map((p) => p.category))]
    this._activeCategory = 'All'

    categories.forEach((cat) => {
      const tab = document.createElement('button')
      tab.className = `library-cat-btn ${cat === 'All' ? 'active' : ''}`
      tab.dataset.category = cat
      tab.textContent = cat
      catTabs.appendChild(tab)
    })

    this.container.appendChild(catTabs)

    // List
    const content = document.createElement('div')
    content.className = 'panel-content'
    content.id = 'library-list'
    this.container.appendChild(content)

    this._renderList()
  }

  _renderList() {
    const list = this.container.querySelector('#library-list')
    if (!list) return

    if (!this.searchWorker) {
      this.searchWorker = new Worker(new URL('../../engine/SearchWorker.js', import.meta.url))
      this.searchWorker.onmessage = (e) => {
        const byId = new Map(state.get('presentations').map((p) => [p.id, p]))
        this._renderListWithResults(e.data.ids.map((id) => byId.get(id)).filter(Boolean))
      }
    }

    let presentations = state.get('presentations')
    const query = state.get('searchQuery') || ''

    // Filter by category
    if (this._activeCategory && this._activeCategory !== 'All') {
      presentations = presentations.filter((p) => p.category === this._activeCategory)
    }

    // Send a flat, pre-lowercased index — much cheaper to clone than full decks.
    // Rebuilt only when the library or category filter changes, not per keystroke.
    if (
      !this._searchIndex ||
      this._searchIndexSource !== state.get('presentations') ||
      this._searchIndexCategory !== this._activeCategory
    ) {
      this._searchIndex = presentations.map((p) => ({
        id: p.id,
        searchText: [
          p.name || '',
          ...(p.tags || []),
          ...(p.slides || []).flatMap((s) => [s.label || '', s.text || ''])
        ]
          .join('\n')
          .toLowerCase()
      }))
      this._searchIndexSource = state.get('presentations')
      this._searchIndexCategory = this._activeCategory
    }
    this.searchWorker.postMessage({ query, items: this._searchIndex })
  }

  _renderListWithResults(presentations) {
    const list = this.container.querySelector('#library-list')
    if (!list) return
    list.innerHTML = ''

    if (presentations.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          ${icon('folder', 48).outerHTML}
          <div class="empty-state__text" style="margin-bottom: var(--spacing-sm);">No presentations found</div>
          <button class="btn btn--primary" id="lib-create-pres-btn">
            <span style="display:flex; align-items:center; justify-content:center;">${icon('plus', 14).outerHTML}</span>
            New Presentation
          </button>
        </div>
      `
      return
    }

    presentations.forEach((pres) => {
      const item = document.createElement('div')
      item.className = `list-item ${state.get('selectedPresentation')?.id === pres.id ? 'active' : ''}`
      item.dataset.id = pres.id
      item.id = `lib-item-${pres.id}`

      const iconEl = icon('file', 16)
      iconEl.className = 'list-item__icon'
      item.appendChild(iconEl)

      const name = document.createElement('span')
      name.className = 'text-ellipsis'
      name.textContent = pres.name
      item.appendChild(name)

      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = pres.slides.length
      item.appendChild(badge)

      list.appendChild(item)
    })
  }

  _bindEvents() {
    // PPTX Import
    this.container
      .querySelector('#library-import-pptx-btn')
      ?.addEventListener('click', async () => {
        if (window.electronAPI && window.electronAPI.importPptx) {
          try {
            const slidesData = await window.electronAPI.importPptx()
            if (slidesData) {
              const newPres = {
                id: 'pptx-' + Date.now(),
                name: 'Imported Presentation',
                category: 'Default',
                slides: slidesData.map((s) => ({
                  id: 'slide-' + Math.random().toString(36).substr(2, 9),
                  text: s.text,
                  type: 'text'
                }))
              }
              const presentations = [...state.get('presentations'), newPres]
              state.set('presentations', presentations)
              state.set('selectedPresentation', newPres)
              state.set('slides', newPres.slides)
              state.set('activeSlideIndex', 0)
              this._renderList()
              showToast('Successfully imported PPTX!', 'success')
            }
          } catch (error) {
            console.error('Failed to import PPTX:', error)
            showToast('Failed to import PPTX.', 'error')
          }
        } else {
          showToast('PPTX import requires Electron environment.', 'error')
        }
      })

    // New Song Import
    this.container.querySelector('#library-add-song-btn')?.addEventListener('click', () => {
      createSongImporter((songData) => {
        const newPres = {
          id: 'song-' + Date.now(),
          name: songData.name,
          category: songData.category,
          slides: songData.slides.map((s) => ({ ...s, type: 'text' }))
        }
        const presentations = [...state.get('presentations'), newPres]
        state.set('presentations', presentations)
        state.set('selectedPresentation', newPres)
        state.set('slides', newPres.slides)
        state.set('activeSlideIndex', 0)
        this._renderList()
        showToast('Song imported successfully!', 'success')
      })
    })

    // New from Template
    this.container.querySelector('#library-template-btn')?.addEventListener('click', () => {
      this._showTemplatePicker()
    })

    // Category filter
    this.container.addEventListener('click', (e) => {
      const catBtn = e.target.closest('.library-cat-btn')
      if (catBtn) {
        this._activeCategory = catBtn.dataset.category
        this.container
          .querySelectorAll('.library-cat-btn')
          .forEach((b) => b.classList.remove('active'))
        catBtn.classList.add('active')
        this._renderList()
        return
      }

      // Presentation selection
      const item = e.target.closest('.list-item')
      if (item) {
        const id = item.dataset.id
        const pres = state.get('presentations').find((p) => p.id === id)
        if (pres) {
          state.set('selectedPresentation', pres)
          state.set('slides', pres.slides)
          state.set('activeSlideIndex', -1)
          this._renderList()
        }
      }
    })

    // Right-click context menu
    this.container.addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.list-item')
      if (!item) return
      e.preventDefault()
      this._showContextMenu(e.clientX, e.clientY, item.dataset.id)
    })
  }

  _showTemplatePicker() {
    document.getElementById('template-picker-overlay')?.remove()

    const overlay = document.createElement('div')
    overlay.id = 'template-picker-overlay'
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:5000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);'

    const cards = CAMP_TEMPLATE_SETS.map(
      (set) => `
        <button class="template-card" data-template="${set.id}" style="background:var(--bg-active);border:1px solid var(--border-color);border-radius:10px;padding:16px;cursor:pointer;text-align:left;display:flex;flex-direction:column;gap:6px;transition:border-color 0.15s;">
          <span style="font-size:14px;font-weight:700;color:var(--text-primary);">${set.name}</span>
          <span style="font-size:11px;color:var(--text-secondary);line-height:1.4;">${set.description}</span>
          <span style="font-size:10px;color:var(--text-muted);margin-top:auto;">${set.slides.length} slides</span>
        </button>`
    ).join('')

    overlay.innerHTML = `
      <div style="background:var(--bg-panel);border-radius:12px;padding:24px;width:640px;max-width:95vw;max-height:85vh;overflow-y:auto;border:1px solid var(--border-color);box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h2 style="margin:0;font-size:16px;color:var(--text-primary);">New from Template</h2>
          <button id="template-picker-close" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:20px;line-height:1;padding:4px;">&#x2715;</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
          ${cards}
        </div>
      </div>
    `

    document.body.appendChild(overlay)

    overlay.querySelector('#template-picker-close').addEventListener('click', () => overlay.remove())
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove()
    })

    overlay.querySelectorAll('.template-card').forEach((card) => {
      card.addEventListener('click', () => {
        const set = CAMP_TEMPLATE_SETS.find((s) => s.id === card.dataset.template)
        if (!set) return

        const newPres = {
          id: `tpl-${set.id}-` + Date.now(),
          name: set.name,
          category: set.type === 'worship' ? 'Worship' : set.type === 'game' ? 'Games' : 'Camp',
          slides: set.slides.map((s) => ({
            ...s,
            id: 'slide-' + Math.random().toString(36).substr(2, 9)
          }))
        }

        const presentations = [...state.get('presentations'), newPres]
        state.set('presentations', presentations)
        state.set('selectedPresentation', newPres)
        state.set('slides', newPres.slides)
        state.set('activeSlideIndex', 0)
        this._renderList()
        overlay.remove()
        showToast(`Created "${set.name}" from template`, 'success')
      })
    })
  }

  _showContextMenu(x, y, presId) {
    // Remove existing
    document.querySelector('.context-menu')?.remove()

    const menu = document.createElement('div')
    menu.className = 'context-menu'
    menu.style.left = `${x}px`
    menu.style.top = `${y}px`
    menu.innerHTML = `
      <div class="context-menu__item" data-action="add-to-playlist">Add to Playlist</div>
      <div class="context-menu__item" data-action="duplicate">${icon('copy', 14).outerHTML} Duplicate</div>
      <div class="context-menu__separator"></div>
      <div class="context-menu__item" data-action="rename">${icon('edit', 14).outerHTML} Rename</div>
      <div class="context-menu__separator"></div>
      <div class="context-menu__item context-menu__item--danger" data-action="delete">${icon('trash', 14).outerHTML} Delete</div>
    `

    document.body.appendChild(menu)

    // Action handlers
    menu.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]')
      if (!actionEl) return
      const action = actionEl.dataset.action
      const presentations = state.get('presentations')
      const pres = presentations.find((p) => p.id === presId)
      if (!pres) return

      switch (action) {
        case 'delete': {
          state.set('presentations', presentations.filter((p) => p.id !== presId))
          if (state.get('selectedPresentation')?.id === presId) {
            state.set('selectedPresentation', null)
            state.set('slides', [])
          }
          this._renderList()
          showToast(`Deleted "${pres.name}"`, 'success')
          break
        }
        case 'duplicate': {
          const copy = JSON.parse(JSON.stringify(pres))
          copy.id = 'dup-' + Date.now()
          copy.name = `${pres.name} (Copy)`
          copy.slides.forEach((s) => {
            s.id = 'slide-' + Math.random().toString(36).substr(2, 9)
          })
          state.set('presentations', [...presentations, copy])
          this._renderList()
          showToast(`Duplicated "${pres.name}"`, 'success')
          break
        }
        case 'rename': {
          this._showRenameDialog(pres)
          break
        }
        case 'add-to-playlist': {
          const playlist = state.get('activePlaylist')
          if (!playlist) {
            showToast('No active playlist', 'error')
            break
          }
          playlist.items = [...(playlist.items || []), { type: 'presentation', id: presId }]
          state.set('playlists', [...state.get('playlists')])
          state.set('activePlaylist', playlist)
          showToast(`Added "${pres.name}" to ${playlist.name}`, 'success')
          break
        }
      }
    })

    // Close on click outside
    const close = () => {
      menu.remove()
      document.removeEventListener('click', close)
    }
    setTimeout(() => document.addEventListener('click', close), 0)
  }

  // window.prompt is unavailable in Electron renderers, so rename uses a tiny modal
  _showRenameDialog(pres) {
    document.getElementById('rename-dialog-overlay')?.remove()

    const overlay = document.createElement('div')
    overlay.id = 'rename-dialog-overlay'
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:5000;display:flex;align-items:center;justify-content:center;'
    overlay.innerHTML = `
      <div style="background:var(--bg-panel);border-radius:10px;padding:20px;width:360px;max-width:90vw;border:1px solid var(--border-color);display:flex;flex-direction:column;gap:12px;">
        <h3 style="margin:0;font-size:14px;color:var(--text-primary);">Rename Presentation</h3>
        <input id="rename-input" class="input" style="font-size:14px;" />
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button class="btn" id="rename-cancel">Cancel</button>
          <button class="btn btn--primary" id="rename-confirm">Rename</button>
        </div>
      </div>
    `
    document.body.appendChild(overlay)

    const input = overlay.querySelector('#rename-input')
    input.value = pres.name
    input.focus()
    input.select()

    const closeDialog = () => overlay.remove()
    const confirm = () => {
      const name = input.value.trim()
      if (name) {
        pres.name = name
        state.set('presentations', [...state.get('presentations')])
        if (state.get('selectedPresentation')?.id === pres.id) {
          state.set('selectedPresentation', { ...pres })
        }
        this._renderList()
        showToast('Renamed presentation', 'success')
      }
      closeDialog()
    }

    overlay.querySelector('#rename-cancel').addEventListener('click', closeDialog)
    overlay.querySelector('#rename-confirm').addEventListener('click', confirm)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirm()
      if (e.key === 'Escape') closeDialog()
    })
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog()
    })
  }
}
