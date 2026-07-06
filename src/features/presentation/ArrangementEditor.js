import { state } from '../../engine/StateManager.js'
import { icon } from '../../components/common/Icons.js'
import {
  MASTER_ARRANGEMENT_ID,
  getArrangements,
  getActiveArrangementId,
  createArrangement,
  deleteArrangement,
  renameArrangement,
  setArrangementSequence
} from '../../engine/arrangement.js'

/**
 * ArrangementEditor — build a named, ordered sequence of a presentation's
 * slides (e.g. Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus) without
 * duplicating slide data. A slide can appear more than once in a sequence.
 *
 * Master (the presentation's stored slide order) is always available and
 * can't be edited/deleted here — it's the reference custom arrangements pull
 * their entries from. All edits happen on a local working copy; nothing is
 * written back to the presentation until "Save & Close".
 */
export class ArrangementEditor {
  constructor() {
    this.overlay = null
    this.pres = null
    this.workingArrangements = []
    this.workingActiveId = MASTER_ARRANGEMENT_ID
  }

  open(presId) {
    const pres = state.get('presentations').find((p) => p.id === presId)
    if (!pres) return
    this.pres = pres
    this.workingArrangements = getArrangements(pres).map((a) => ({ ...a, sequence: [...a.sequence] }))
    this.workingActiveId = getActiveArrangementId(pres)

    if (this.overlay) this.close()

    this.overlay = document.createElement('div')
    this.overlay.id = 'arrangement-editor-overlay'
    this.overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.75)',
      'z-index:5000',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'backdrop-filter:blur(4px)'
    ].join(';')

    const panel = document.createElement('div')
    panel.id = 'arrangement-editor-panel'
    panel.style.cssText = [
      'background:var(--bg-panel)',
      'border-radius:12px',
      'padding:24px',
      'width:640px',
      'max-width:95vw',
      'max-height:85vh',
      'display:flex',
      'flex-direction:column',
      'gap:16px',
      'box-shadow:0 20px 60px rgba(0,0,0,0.5)',
      'border:1px solid var(--border-color)'
    ].join(';')

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <h2 style="margin:0;font-size:16px;color:var(--text-primary);">Arrangement — ${this._esc(pres.name)}</h2>
        <button id="arr-close" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:20px;line-height:1;padding:4px;">&#x2715;</button>
      </div>

      <div id="arr-tabs" style="display:flex;flex-wrap:wrap;gap:6px;"></div>

      <div style="display:flex;gap:16px;min-height:0;flex:1;">
        <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;">
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">Sequence</div>
          <div id="arr-sequence" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;border:1px solid var(--border-color);border-radius:8px;padding:8px;min-height:200px;"></div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;">
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">Add Slide</div>
          <div id="arr-available" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;border:1px solid var(--border-color);border-radius:8px;padding:8px;min-height:200px;"></div>
        </div>
      </div>

      <div style="display:flex;gap:10px;">
        <button id="arr-save" class="btn btn--primary" style="flex:1;height:40px;">Save &amp; Close</button>
        <button id="arr-cancel" class="btn" style="height:40px;padding:0 20px;">Cancel</button>
      </div>
    `

    this.overlay.appendChild(panel)
    document.body.appendChild(this.overlay)
    this.panel = panel

    panel.querySelector('#arr-close').addEventListener('click', () => this.close())
    panel.querySelector('#arr-cancel').addEventListener('click', () => this.close())
    panel.querySelector('#arr-save').addEventListener('click', () => this._save())
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })

    this._renderTabs()
    this._renderSequence()
    this._renderAvailable()
  }

  close() {
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
  }

  _activeArrangement() {
    return this.workingArrangements.find((a) => a.id === this.workingActiveId) || this.workingArrangements[0]
  }

  _renderTabs() {
    const tabs = this.panel.querySelector('#arr-tabs')
    tabs.innerHTML = ''

    this.workingArrangements.forEach((a) => {
      const tab = document.createElement('button')
      tab.className = 'btn'
      tab.dataset.arrId = a.id
      const active = a.id === this.workingActiveId
      tab.style.cssText = active
        ? 'background:var(--primary-color);border-color:var(--primary-color);color:#fff;font-size:12px;height:30px;padding:0 12px;'
        : 'font-size:12px;height:30px;padding:0 12px;'
      tab.textContent = a.name
      tab.addEventListener('click', () => {
        this.workingActiveId = a.id
        this._renderTabs()
        this._renderSequence()
      })
      tabs.appendChild(tab)

      if (a.id !== MASTER_ARRANGEMENT_ID && active) {
        const rename = document.createElement('button')
        rename.className = 'btn btn--icon'
        rename.title = 'Rename'
        rename.style.cssText = 'height:30px;width:30px;'
        rename.innerHTML = icon('edit', 12).outerHTML
        rename.addEventListener('click', () => this._renameActive())
        tabs.appendChild(rename)

        const del = document.createElement('button')
        del.className = 'btn btn--icon'
        del.title = 'Delete arrangement'
        del.style.cssText = 'height:30px;width:30px;color:var(--accent-red);'
        del.innerHTML = icon('trash', 12).outerHTML
        del.addEventListener('click', () => this._deleteActive())
        tabs.appendChild(del)
      }
    })

    const addBtn = document.createElement('button')
    addBtn.className = 'btn btn--icon'
    addBtn.title = 'New arrangement'
    addBtn.style.cssText = 'height:30px;width:30px;'
    addBtn.innerHTML = icon('plus', 12).outerHTML
    addBtn.addEventListener('click', () => {
      const { arrangements, newId } = createArrangement(this.workingArrangements, 'New Arrangement')
      this.workingArrangements = arrangements
      this.workingActiveId = newId
      this._renderTabs()
      this._renderSequence()
    })
    tabs.appendChild(addBtn)
  }

  _renameActive() {
    const arr = this._activeArrangement()
    if (!arr || arr.id === MASTER_ARRANGEMENT_ID) return

    const input = document.createElement('input')
    input.className = 'input'
    input.value = arr.name
    input.style.cssText = 'font-size:12px;height:30px;width:140px;'

    const tabs = this.panel.querySelector('#arr-tabs')
    const tabBtn = tabs.querySelector(`[data-arr-id="${arr.id}"]`)
    tabBtn.replaceWith(input)
    input.focus()
    input.select()

    const commit = () => {
      const name = input.value.trim()
      if (name) this.workingArrangements = renameArrangement(this.workingArrangements, arr.id, name)
      this._renderTabs()
      this._renderSequence()
    }
    input.addEventListener('blur', commit)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur()
      if (e.key === 'Escape') {
        this._renderTabs()
      }
    })
  }

  _deleteActive() {
    const arr = this._activeArrangement()
    if (!arr || arr.id === MASTER_ARRANGEMENT_ID) return
    this.workingArrangements = deleteArrangement(this.workingArrangements, arr.id)
    this.workingActiveId = MASTER_ARRANGEMENT_ID
    this._renderTabs()
    this._renderSequence()
  }

  _renderSequence() {
    const container = this.panel.querySelector('#arr-sequence')
    container.innerHTML = ''

    const arr = this._activeArrangement()
    const isMaster = !arr || arr.id === MASTER_ARRANGEMENT_ID
    const byId = new Map(this.pres.slides.map((s) => [s.id, s]))

    if (isMaster) {
      const note = document.createElement('div')
      note.style.cssText = 'font-size:12px;color:var(--text-secondary);padding:8px;'
      note.textContent =
        'Master reflects your slide order as stored. Create a new arrangement to build a custom sequence with repeats.'
      container.appendChild(note)
    }

    const sequence = isMaster ? this.pres.slides.map((s) => s.id) : arr.sequence
    if (sequence.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = 'font-size:12px;color:var(--text-secondary);padding:8px;text-align:center;'
      empty.textContent = 'Empty — add slides from the right.'
      container.appendChild(empty)
    }

    sequence.forEach((slideId, i) => {
      const slide = byId.get(slideId)
      const row = document.createElement('div')
      row.style.cssText =
        'display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--bg-hover);border-radius:6px;font-size:12px;'
      row.innerHTML = `
        <span style="color:var(--text-secondary);min-width:18px;">${i + 1}</span>
        <span style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this._esc(slide?.label || slide?.text?.split('\n')[0] || '(missing slide)')}</span>
      `
      if (!isMaster) {
        const up = this._iconBtn('chevronUp', 'Move up', () => this._move(i, -1))
        const down = this._iconBtn('chevronDown', 'Move down', () => this._move(i, 1))
        const remove = this._iconBtn('x', 'Remove', () => this._removeAt(i))
        row.appendChild(up)
        row.appendChild(down)
        row.appendChild(remove)
      }
      container.appendChild(row)
    })
  }

  _renderAvailable() {
    const container = this.panel.querySelector('#arr-available')
    container.innerHTML = ''

    this.pres.slides.forEach((slide) => {
      const row = document.createElement('button')
      row.className = 'btn'
      row.style.cssText =
        'display:flex;justify-content:flex-start;text-align:left;font-size:12px;height:auto;padding:6px 10px;overflow:hidden;'
      row.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this._esc(slide.label || slide.text?.split('\n')[0] || '(untitled)')}</span>`
      row.addEventListener('click', () => this._append(slide.id))
      container.appendChild(row)
    })
  }

  _iconBtn(name, title, onClick) {
    const btn = document.createElement('button')
    btn.className = 'btn btn--icon'
    btn.title = title
    btn.style.cssText = 'height:22px;width:22px;flex-shrink:0;'
    btn.innerHTML = icon(name, 11).outerHTML
    btn.addEventListener('click', onClick)
    return btn
  }

  _append(slideId) {
    const arr = this._activeArrangement()
    if (!arr || arr.id === MASTER_ARRANGEMENT_ID) return // Master isn't hand-edited
    this.workingArrangements = setArrangementSequence(this.workingArrangements, arr.id, [...arr.sequence, slideId])
    this._renderSequence()
  }

  _removeAt(index) {
    const arr = this._activeArrangement()
    if (!arr || arr.id === MASTER_ARRANGEMENT_ID) return
    const next = arr.sequence.filter((_, i) => i !== index)
    this.workingArrangements = setArrangementSequence(this.workingArrangements, arr.id, next)
    this._renderSequence()
  }

  _move(index, delta) {
    const arr = this._activeArrangement()
    if (!arr || arr.id === MASTER_ARRANGEMENT_ID) return
    const target = index + delta
    if (target < 0 || target >= arr.sequence.length) return
    const next = [...arr.sequence]
    ;[next[index], next[target]] = [next[target], next[index]]
    this.workingArrangements = setArrangementSequence(this.workingArrangements, arr.id, next)
    this._renderSequence()
  }

  _save() {
    // Master is never persisted — it's always derived from pres.slides — so
    // strip it back out before writing (only custom arrangements are stored).
    const toStore = this.workingArrangements.filter((a) => a.id !== MASTER_ARRANGEMENT_ID)

    state.updatePresentation(this.pres.id, (p) => {
      p.arrangements = toStore
      p.activeArrangementId = this.workingActiveId
    })

    const selected = state.get('selectedPresentation')
    if (selected && selected.id === this.pres.id) {
      const presentations = state.get('presentations')
      state.set('selectedPresentation', presentations.find((p) => p.id === this.pres.id))
    }

    this.close()
  }

  _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}

export const arrangementEditor = new ArrangementEditor()
