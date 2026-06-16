import { state } from '../../engine/StateManager.js'
import { icon } from '../../components/common/Icons.js'
import { createSongImporter } from './SongImporter.js'
import { showToast } from '../../components/common/ToastManager.js'

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
        this._renderListWithResults(e.data.results)
      }
    }

    let presentations = state.get('presentations')
    const query = state.get('searchQuery') || ''

    // Filter by category
    if (this._activeCategory && this._activeCategory !== 'All') {
      presentations = presentations.filter((p) => p.category === this._activeCategory)
    }

    // Pass to worker for search
    this.searchWorker.postMessage({ query, presentations })
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

    // Close on click outside
    const close = () => {
      menu.remove()
      document.removeEventListener('click', close)
    }
    setTimeout(() => document.addEventListener('click', close), 0)
  }
}
