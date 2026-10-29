import { state } from '../../core/StateManager.js'
import { icon } from '../../components/common/Icons.js'
import { printSetlist } from '../../songs/printSheet.js'
import { showToast } from '../../components/common/ToastManager.js'
import * as ops from '../../core/playlistOps.js'

const MENU_STYLE =
  'display:none;position:absolute;right:0;top:100%;background:var(--bg-toolbar);border:1px solid var(--border-color);border-radius:4px;padding:4px 0;min-width:170px;z-index:10;'
const MENU_ITEM_STYLE = 'padding:8px 16px;cursor:pointer;font-size:13px;'

/**
 * PlaylistPanel — service order management: switch between setlists, create /
 * rename / duplicate / delete them, and add, reorder and remove their items.
 *
 * All text from the library (setlist names, headers, notes, song titles) is
 * written with textContent, never innerHTML, so imported data can't inject markup.
 */
export class PlaylistPanel {
  constructor(container) {
    this.container = container
    this.render()
    this._bindEvents()

    state.on('selectedPresentation', () => this._renderItems())
    state.on('presentations', () => this._renderItems()) // a deleted/restored song must not linger in the open setlist
    state.on('playlists', () => this._renderItems())
    state.on('activePlaylist', () => this._renderItems())
    // Close any open dropdown when clicking elsewhere (one listener, not one per render)
    document.addEventListener('click', (e) => {
      this.container.querySelectorAll('.playlist-menu').forEach((menu) => {
        if (!menu.parentElement.contains(e.target)) menu.style.display = 'none'
      })
    })
  }

  // ---- layout ----------------------------------------------------------

  render() {
    this.container.innerHTML = ''
    this.container.appendChild(this._buildHeader())

    const playlist = state.get('activePlaylist')
    if (playlist) this.container.appendChild(this._buildNameBar(playlist))

    const content = document.createElement('div')
    content.className = 'panel-content'
    content.id = 'playlist-items'
    this.container.appendChild(content)

    this.scroller = null // the old scroller belonged to the container we just emptied
    this._renderItems()
  }

  _buildHeader() {
    const header = document.createElement('div')
    header.className = 'panel-header'
    header.innerHTML = `
      <span class="panel-header__title">Playlist</span>
      <div class="panel-header__actions">
        <button class="btn" id="playlist-print-btn" title="Print chord sheets for this setlist">
          ${icon('file', 14).outerHTML} <span class="playlist-btn-label">Print</span>
        </button>
        <div style="position:relative;">
          <button class="btn" id="playlist-add-btn" title="Add Item">${icon('plus', 14).outerHTML} <span class="playlist-btn-label">Add Item</span></button>
          <div class="playlist-menu" id="playlist-add-dropdown" style="${MENU_STYLE}">
            <div class="dropdown-item" data-add="song" style="${MENU_ITEM_STYLE}">Add Song…</div>
            <div class="dropdown-item" data-add="header" style="${MENU_ITEM_STYLE}">Add Header</div>
            <div class="dropdown-item" data-add="note" style="${MENU_ITEM_STYLE}">Add Note</div>
          </div>
        </div>
      </div>
    `
    return header
  }

  _buildNameBar(playlist) {
    const bar = document.createElement('div')
    bar.className = 'playlist-name'
    bar.style.position = 'relative'

    const iconEl = document.createElement('span')
    iconEl.className = 'playlist-name__icon'
    iconEl.appendChild(icon('list', 14))
    bar.appendChild(iconEl)

    const all = state.get('playlists') || []
    if (all.length > 1) {
      const select = document.createElement('select')
      select.className = 'playlist-name__select'
      select.id = 'playlist-switcher'
      select.title = 'Switch setlist'
      select.setAttribute('aria-label', 'Setlist')
      for (const p of all) {
        const option = document.createElement('option')
        option.value = p.id
        option.textContent = p.name
        option.selected = p.id === playlist.id
        select.appendChild(option)
      }
      bar.appendChild(select)
    } else {
      const text = document.createElement('span')
      text.className = 'playlist-name__text'
      text.style.flex = '1'
      text.textContent = playlist.name
      bar.appendChild(text)
    }

    const manage = document.createElement('div')
    manage.style.position = 'relative'
    manage.innerHTML = `
      <button class="btn btn--icon" id="playlist-manage-btn" title="Manage setlists" aria-label="Manage setlists" style="min-width:28px;height:28px;">⋯</button>
      <div class="playlist-menu" id="playlist-manage-menu" style="${MENU_STYLE}">
        <div class="dropdown-item" data-manage="new" style="${MENU_ITEM_STYLE}">New setlist…</div>
        <div class="dropdown-item" data-manage="rename" style="${MENU_ITEM_STYLE}">Rename…</div>
        <div class="dropdown-item" data-manage="duplicate" style="${MENU_ITEM_STYLE}">Duplicate</div>
        <div class="dropdown-item" data-manage="delete" style="${MENU_ITEM_STYLE}">Delete…</div>
      </div>
    `
    bar.appendChild(manage)
    return bar
  }

  // ---- state changes ---------------------------------------------------

  /** Copy-on-write: store an updated playlist and make it the active one. */
  _commit(updated) {
    state.set('playlists', ops.replacePlaylist(state.get('playlists') || [], updated))
    state.set('activePlaylist', updated)
    this._renderItems()
  }

  _addPlaylistItem(item) {
    const playlist = state.get('activePlaylist')
    if (!playlist) return
    this._commit(ops.addItem(playlist, item))

    // New items append at the end — scroll them into view so the add is visible
    const list = this.container.querySelector('#playlist-items')
    if (list) {
      requestAnimationFrame(() => {
        list.scrollTop = list.scrollHeight
      })
    }
  }

  _switchTo(playlist) {
    state.set('activePlaylist', playlist)
    this.render()
  }

  _newPlaylist() {
    this._showTextPrompt('New setlist', 'e.g. Sunday 3 March', (name) => {
      const created = ops.createPlaylist(name)
      state.set('playlists', [...(state.get('playlists') || []), created])
      this._switchTo(created)
    }, { confirmLabel: 'Create' })
  }

  _renamePlaylist() {
    const playlist = state.get('activePlaylist')
    if (!playlist) return
    this._showTextPrompt('Rename setlist', 'Setlist name', (name) => {
      const updated = ops.renamePlaylist(playlist, name)
      state.set('playlists', ops.replacePlaylist(state.get('playlists') || [], updated))
      this._switchTo(updated)
    }, { initial: playlist.name, confirmLabel: 'Rename' })
  }

  _duplicatePlaylist() {
    const playlist = state.get('activePlaylist')
    if (!playlist) return
    const copy = ops.duplicatePlaylist(playlist)
    state.set('playlists', [...(state.get('playlists') || []), copy])
    this._switchTo(copy)
    showToast(`Created "${copy.name}"`, 'success')
  }

  _deletePlaylist() {
    const playlist = state.get('activePlaylist')
    if (!playlist) return
    this._showConfirm(
      `Delete the setlist "${playlist.name}"? The songs stay in your library.`,
      'Delete',
      () => {
        const { playlists, next } = ops.deletePlaylist(state.get('playlists') || [], playlist.id)
        state.set('playlists', playlists)
        this._switchTo(next)
      }
    )
  }

  _moveItem(index, direction) {
    const playlist = state.get('activePlaylist')
    if (playlist) this._commit(ops.moveItem(playlist, index, direction))
  }

  _removeItem(index) {
    const playlist = state.get('activePlaylist')
    if (playlist) this._commit(ops.removeItem(playlist, index))
  }

  // ---- dialogs (window.prompt/confirm are unreliable in Electron renderers) ----

  _openOverlay(id) {
    document.getElementById(id)?.remove()
    const overlay = document.createElement('div')
    overlay.id = id
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;'
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove()
    })
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') overlay.remove()
    })
    document.body.appendChild(overlay)
    return overlay
  }

  _dialogBox(title) {
    const box = document.createElement('div')
    box.style.cssText =
      'background:var(--bg-panel);border-radius:10px;padding:20px;width:340px;max-width:90vw;border:1px solid var(--border-color);display:flex;flex-direction:column;gap:12px;'
    const h = document.createElement('h3')
    h.style.cssText = 'margin:0;font-size:14px;color:var(--text-primary);'
    h.textContent = title
    box.appendChild(h)
    return box
  }

  _buttonRow(box, confirmLabel, onConfirm, onCancel) {
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;'
    const cancel = document.createElement('button')
    cancel.className = 'btn'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', onCancel)
    const ok = document.createElement('button')
    ok.className = 'btn btn--primary'
    ok.textContent = confirmLabel
    ok.addEventListener('click', onConfirm)
    row.append(cancel, ok)
    box.appendChild(row)
    return ok
  }

  _showTextPrompt(title, placeholder, onConfirm, { initial = '', confirmLabel = 'Add' } = {}) {
    const overlay = this._openOverlay('playlist-prompt-overlay')
    const box = this._dialogBox(title)

    const input = document.createElement('input')
    input.className = 'input'
    input.placeholder = placeholder
    input.value = initial
    input.setAttribute('aria-label', title)
    input.style.fontSize = '14px'
    box.appendChild(input)

    const close = () => overlay.remove()
    const confirm = () => {
      const text = input.value.trim()
      if (text) onConfirm(text)
      close()
    }
    this._buttonRow(box, confirmLabel, confirm, close)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirm()
    })
    overlay.appendChild(box)
    input.focus()
    input.select()
  }

  _showConfirm(message, confirmLabel, onConfirm) {
    const overlay = this._openOverlay('confirm-dialog-overlay')
    const box = this._dialogBox('Are you sure?')
    const p = document.createElement('div')
    p.style.cssText = 'font-size:13px;color:var(--text-secondary);'
    p.textContent = message
    box.appendChild(p)
    const ok = this._buttonRow(box, confirmLabel, () => {
      overlay.remove()
      onConfirm()
    }, () => overlay.remove())
    overlay.appendChild(box)
    ok.focus()
  }

  _showSongPicker() {
    const overlay = this._openOverlay('playlist-song-picker-overlay')
    const box = this._dialogBox('Add a song to the setlist')
    box.style.width = '380px'

    const search = document.createElement('input')
    search.className = 'input'
    search.placeholder = 'Search the library…'
    search.setAttribute('aria-label', 'Search the library')
    box.appendChild(search)

    const list = document.createElement('div')
    list.style.cssText = 'max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:2px;'
    box.appendChild(list)

    const fill = () => {
      const q = search.value.trim().toLowerCase()
      list.textContent = ''
      const matches = (state.get('presentations') || []).filter((p) => !q || p.name.toLowerCase().includes(q))
      for (const p of matches) {
        const row = document.createElement('button')
        row.className = 'btn'
        row.style.cssText = 'justify-content:flex-start;border:none;text-align:left;'
        row.textContent = p.name
        row.addEventListener('click', () => {
          this._addPlaylistItem({ type: 'presentation', id: p.id })
          overlay.remove()
        })
        list.appendChild(row)
      }
      if (!matches.length) {
        const none = document.createElement('div')
        none.style.cssText = 'padding:8px;color:var(--text-muted);font-size:13px;'
        none.textContent = 'No songs match.'
        list.appendChild(none)
      }
    }
    search.addEventListener('input', fill)
    fill()

    const row = document.createElement('div')
    row.style.cssText = 'display:flex;justify-content:flex-end;'
    const close = document.createElement('button')
    close.className = 'btn'
    close.textContent = 'Close'
    close.addEventListener('click', () => overlay.remove())
    row.appendChild(close)
    box.appendChild(row)

    overlay.appendChild(box)
    search.focus()
  }

  // ---- items -------------------------------------------------------------

  _renderItems() {
    const list = this.container.querySelector('#playlist-items')
    if (!list) return

    const playlist = state.get('activePlaylist')
    if (!playlist) {
      list.innerHTML = `
        <div class="empty-state">
          ${icon('list', 48).outerHTML}
          <div class="empty-state__text" style="margin-bottom: var(--spacing-sm);">No setlist yet</div>
          <button class="btn btn--primary" data-action="create-playlist">${icon('plus', 14).outerHTML} Create Setlist</button>
        </div>
      `
      this.scroller = null
      return
    }

    if (!this.scroller) {
      list.innerHTML = ''
      import('../../components/common/VirtualScroller.js').then(({ VirtualScroller }) => {
        if (this.scroller) return // a faster render got there first
        this.scroller = new VirtualScroller(list, {
          getItemHeight: (item) => (item.type === 'header' ? 36 : 44),
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
    if (!this.scroller) return
    const playlist = state.get('activePlaylist')
    this.scroller.setItems(playlist ? playlist.items : [])
  }

  /** Small ↑ ↓ ✕ buttons; every row gets them so a setlist can be reordered without dragging. */
  _controls(index, count) {
    const wrap = document.createElement('span')
    wrap.className = 'playlist-item__controls'
    wrap.style.cssText = 'gap:2px;margin-left:auto;flex-shrink:0;' // display comes from toolbar.css (hover/focus/touch)
    const make = (action, glyph, label, disabled) => {
      const b = document.createElement('button')
      b.className = 'btn btn--icon'
      b.dataset.action = action
      b.dataset.index = index
      b.title = label
      b.setAttribute('aria-label', label)
      b.textContent = glyph
      b.disabled = disabled
      b.style.cssText = 'min-width:24px;height:24px;padding:0;font-size:12px;'
      return b
    }
    wrap.append(
      make('move-up', '↑', 'Move up', index === 0),
      make('move-down', '↓', 'Move down', index === count - 1),
      make('remove', '✕', 'Remove from setlist', false)
    )
    return wrap
  }

  _updateItemDom(el, item, index) {
    // Elements are recycled by the scroller, so start from a clean slate
    el.className = ''
    el.style.cssText = ''
    el.textContent = ''
    delete el.dataset.id
    delete el.dataset.index
    const count = state.get('activePlaylist')?.items.length || 0

    if (item.type === 'header') {
      el.className = 'playlist-header-item'
      const text = document.createElement('span')
      text.style.cssText = 'font-weight:600;color:var(--text-muted);font-size:12px;text-transform:uppercase;'
      text.textContent = item.text
      el.style.cssText = 'padding:4px 12px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;'
      el.append(text, this._controls(index, count))
    } else if (item.type === 'note') {
      el.className = 'playlist-note-item'
      const text = document.createElement('span')
      text.style.cssText = 'color:var(--text-color);font-style:italic;font-size:12px;'
      text.textContent = item.text
      el.style.cssText =
        'padding:8px 12px;background-color:var(--bg-toolbar);border-left:3px solid var(--primary-color);margin-bottom:4px;display:flex;align-items:center;'
      el.append(text, this._controls(index, count))
    } else if (item.type === 'presentation') {
      const pres = (state.get('presentations') || []).find((p) => p.id === item.id)
      if (!pres) {
        // The song was deleted from the library: say so, and let it be removed
        el.className = 'list-item playlist-item--missing'
        const text = document.createElement('span')
        text.className = 'text-ellipsis flex-1'
        text.style.cssText = 'color:var(--text-muted);font-style:italic;'
        text.textContent = 'Song removed from the library'
        el.append(text, this._controls(index, count))
        return
      }

      const isSelected = state.get('selectedPresentation')?.id === pres.id
      el.className = `list-item playlist-item ${isSelected ? 'active' : ''}`
      el.dataset.id = pres.id
      el.dataset.index = index

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

      el.appendChild(this._controls(index, count))
    }
  }

  // ---- events ------------------------------------------------------------

  _bindEvents() {
    this.container.addEventListener('click', (e) => {
      const target = e.target

      // Row controls: ↑ ↓ ✕
      const control = target.closest('[data-action]')
      if (control && !control.disabled) {
        const index = Number(control.dataset.index)
        switch (control.dataset.action) {
          case 'move-up':
            this._moveItem(index, -1)
            break
          case 'move-down':
            this._moveItem(index, 1)
            break
          case 'remove':
            this._removeItem(index)
            break
          case 'create-playlist':
            this._newPlaylist()
            break
        }
        return
      }

      // Print
      if (target.closest('#playlist-print-btn')) {
        const pl = state.get('activePlaylist')
        if (pl) printSetlist(pl, state.get('presentations') || [])
        else showToast('Create a setlist first', 'error')
        return
      }

      // Dropdown toggles
      const addBtn = target.closest('#playlist-add-btn')
      const manageBtn = target.closest('#playlist-manage-btn')
      if (addBtn || manageBtn) {
        const menu = this.container.querySelector(addBtn ? '#playlist-add-dropdown' : '#playlist-manage-menu')
        const open = menu.style.display === 'block'
        this.container.querySelectorAll('.playlist-menu').forEach((m) => (m.style.display = 'none'))
        menu.style.display = open ? 'none' : 'block'
        return
      }

      // Add Item menu
      const add = target.closest('[data-add]')
      if (add) {
        this.container.querySelectorAll('.playlist-menu').forEach((m) => (m.style.display = 'none'))
        if (!state.get('activePlaylist')) return this._newPlaylist()
        if (add.dataset.add === 'song') this._showSongPicker()
        else if (add.dataset.add === 'header') {
          this._showTextPrompt('Add Header', 'Header text', (text) => this._addPlaylistItem({ type: 'header', text }))
        } else {
          this._showTextPrompt('Add Note', 'Note text', (text) => this._addPlaylistItem({ type: 'note', text }))
        }
        return
      }

      // Manage menu
      const manage = target.closest('[data-manage]')
      if (manage) {
        this.container.querySelectorAll('.playlist-menu').forEach((m) => (m.style.display = 'none'))
        const action = manage.dataset.manage
        if (action === 'new') this._newPlaylist()
        else if (action === 'rename') this._renamePlaylist()
        else if (action === 'duplicate') this._duplicatePlaylist()
        else if (action === 'delete') this._deletePlaylist()
        return
      }

      // Select a song
      const item = target.closest('.playlist-item')
      if (item) {
        const pres = state.get('presentations').find((p) => p.id === item.dataset.id)
        if (pres) {
          state.set('selectedPresentation', pres)
          state.set('activeSlideIndex', -1)
          this._renderItems()
        }
      }
    })

    this.container.addEventListener('change', (e) => {
      if (e.target.id !== 'playlist-switcher') return
      const next = (state.get('playlists') || []).find((p) => p.id === e.target.value)
      if (next) this._switchTo(next)
    })
  }
}
