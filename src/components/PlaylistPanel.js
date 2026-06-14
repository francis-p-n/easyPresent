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
    header.innerHTML = `
      <span class="panel-header__title">Playlist</span>
      <div class="panel-header__actions">
        <button class="btn btn--icon" id="playlist-add-btn" title="Add Item">
          ${icon('plus', 14).outerHTML}
        </button>
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

    this._renderItems()
  }

  _renderItems() {
    const list = this.container.querySelector('#playlist-items')
    if (!list) return
    list.innerHTML = ''

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

    const presentations = state.get('presentations')

    playlist.items.forEach((item, index) => {
      if (item.type === 'header') {
        const header = document.createElement('div')
        header.className = 'playlist-header-item'
        header.innerHTML = `<span>${item.text}</span>`
        list.appendChild(header)
      } else if (item.type === 'presentation') {
        const pres = presentations.find(p => p.id === item.id)
        if (!pres) return

        const el = document.createElement('div')
        const isSelected = state.get('selectedPresentation')?.id === pres.id
        el.className = `list-item playlist-item ${isSelected ? 'active' : ''}`
        el.dataset.id = pres.id
        el.dataset.index = index

        const grip = icon('grip', 14)
        grip.className = 'list-item__icon playlist-item__grip'
        el.appendChild(grip)

        const fileIcon = icon('file', 14)
        fileIcon.className = 'list-item__icon'
        el.appendChild(fileIcon)

        const name = document.createElement('span')
        name.className = 'text-ellipsis'
        name.textContent = pres.name
        el.appendChild(name)

        const badge = document.createElement('span')
        badge.className = 'badge'
        badge.textContent = pres.slides.length
        el.appendChild(badge)

        list.appendChild(el)
      }
    })
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
