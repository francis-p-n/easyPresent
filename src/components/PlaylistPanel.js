import { state } from '../engine/StateManager.js'
import { icon } from './Icons.js'

/**
 * PlaylistPanel — Service order management
 */
export class PlaylistPanel {
  constructor(container) {
    this.container = container
    this.render()
    this._bindEvents()

    state.on('selectedPresentation', () => this._renderItems())
  }

  render() {
    this.container.innerHTML = ''

    // Header
    const header = document.createElement('div')
    header.className = 'panel-header'
    const menuBtnHtml = `
      <div style="position: relative;" id="playlist-add-menu-container">
        <button class="btn" id="playlist-add-btn" title="Add Item">
          ${icon('plus', 14).outerHTML} Add Item
        </button>
        <div id="playlist-add-dropdown" style="display: none; position: absolute; right: 0; top: 100%; background: var(--bg-toolbar); border: 1px solid var(--border-color); border-radius: 4px; padding: 4px 0; min-width: 150px; z-index: 10;">
          <div class="dropdown-item" id="add-header-btn" style="padding: 8px 16px; cursor: pointer; font-size: 13px;">Add Header</div>
          <div class="dropdown-item" id="add-note-btn" style="padding: 8px 16px; cursor: pointer; font-size: 13px;">Add Note</div>
        </div>
      </div>
    `
    header.innerHTML = `
      <span class="panel-header__title">Playlist</span>
      <div class="panel-header__actions">
        ${menuBtnHtml}
      </div>
    `
    this.container.appendChild(header)

    // Playlist name
    const playlist = state.get('activePlaylist')
    if (playlist) {
      const nameBar = document.createElement('div')
      nameBar.className = 'playlist-name'
      nameBar.innerHTML = `
        <span class="playlist-name__icon">${icon('list', 14).outerHTML}</span>
        <span class="playlist-name__text">${playlist.name}</span>
      `
      this.container.appendChild(nameBar)
    }

    // Items list
    const content = document.createElement('div')
    content.className = 'panel-content'
    content.id = 'playlist-items'
    this.container.appendChild(content)

    // Add event listeners for the dropdown
    const addBtn = this.container.querySelector('#playlist-add-btn')
    const dropdown = this.container.querySelector('#playlist-add-dropdown')
    const menuContainer = this.container.querySelector('#playlist-add-menu-container')

    if (addBtn && dropdown) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none'
      })

      document.addEventListener('click', (e) => {
        if (menuContainer && !menuContainer.contains(e.target)) {
          dropdown.style.display = 'none'
        }
      })

      // Add Header
      this.container.querySelector('#add-header-btn')?.addEventListener('click', () => {
        dropdown.style.display = 'none'
        const text = prompt('Enter header text:')
        if (text) {
          const playlist = state.get('activePlaylist')
          if (playlist) {
            playlist.items.push({ type: 'header', text })
            state.set('activePlaylist', playlist)
            this._renderItems()
          }
        }
      })

      // Add Note
      this.container.querySelector('#add-note-btn')?.addEventListener('click', () => {
        dropdown.style.display = 'none'
        const text = prompt('Enter note text:')
        if (text) {
          const playlist = state.get('activePlaylist')
          if (playlist) {
            playlist.items.push({ type: 'note', text })
            state.set('activePlaylist', playlist)
            this._renderItems()
          }
        }
      })
    }

    this._renderItems()
  }

  _renderItems() {
    const list = this.container.querySelector('#playlist-items')
    if (!list) return

    const playlist = state.get('activePlaylist')
    if (!playlist) {
      list.innerHTML = `
        <div class="empty-state">
          ${icon('list', 48).outerHTML}
          <div class="empty-state__text" style="margin-bottom: var(--spacing-sm);">No playlist selected</div>
          <button class="btn btn--primary">${icon('plus', 14).outerHTML} Create Playlist</button>
        </div>
      `
      return
    }

    if (!this.scroller) {
      list.innerHTML = '';
      import('./VirtualScroller.js').then(({ VirtualScroller }) => {
        this.scroller = new VirtualScroller(list, {
          getItemHeight: (item) => item.type === 'header' ? 36 : 44,
          renderItem: (item, index) => {
            const el = document.createElement('div')
            this._updateItemDom(el, item, index)
            return el
          },
          updateItem: (el, item, index) => {
            this._updateItemDom(el, item, index)
          }
        })
        this._updateScrollerData()
      })
    } else {
      this._updateScrollerData()
    }
  }

  _updateScrollerData() {
    if (!this.scroller) return;
    const playlist = state.get('activePlaylist')
    if (!playlist) {
        this.scroller.setItems([]);
        return;
    }
    this.scroller.setItems(playlist.items)
  }

  _updateItemDom(el, item, index) {
    if (item.type === 'header') {
      el.className = 'playlist-header-item'
      el.innerHTML = `<span style="font-weight: 600; color: var(--text-muted); font-size: 11px; text-transform: uppercase;">${item.text}</span>`
      el.style.padding = '8px 12px 4px 12px'
      el.style.borderBottom = '1px solid var(--border-color)'
    } else if (item.type === 'note') {
      el.className = 'playlist-note-item'
      el.innerHTML = `<span style="color: var(--text-color); font-style: italic; font-size: 12px;">${item.text}</span>`
      el.style.padding = '8px 12px'
      el.style.backgroundColor = 'var(--bg-toolbar)'
      el.style.borderLeft = '3px solid var(--primary-color)'
      el.style.marginBottom = '4px'
    } else if (item.type === 'presentation') {
      const presentations = state.get('presentations')
      const pres = presentations.find(p => p.id === item.id)
      if (!pres) {
        el.innerHTML = '';
        return;
      }

      const isSelected = state.get('selectedPresentation')?.id === pres.id
      el.className = `list-item playlist-item ${isSelected ? 'active' : ''}`
      el.dataset.id = pres.id
      el.dataset.index = index
      el.innerHTML = ''

      const grip = icon('grip', 14)
      grip.className = 'list-item__icon playlist-item__grip'
      el.appendChild(grip)

      const fileIcon = icon('file', 14)
      fileIcon.className = 'list-item__icon'
      el.appendChild(fileIcon)

      const name = document.createElement('span')
      name.className = 'text-ellipsis flex-1'
      name.textContent = pres.name
      el.appendChild(name)

      const badge = document.createElement('span')
      badge.className = 'badge'
      badge.textContent = pres.slides.length
      el.appendChild(badge)
    }
  }

  _bindEvents() {
    this.container.addEventListener('click', (e) => {
      const item = e.target.closest('.playlist-item')
      if (item) {
        const id = item.dataset.id
        const pres = state.get('presentations').find(p => p.id === id)
        if (pres) {
          state.set('selectedPresentation', pres)
          state.set('slides', pres.slides)
          state.set('activeSlideIndex', -1)
          this._renderItems()
        }
      }
    })
  }
}
