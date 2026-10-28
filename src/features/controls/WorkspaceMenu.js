import { state } from '../../core/StateManager.js'
import {
  loadWorkspaces,
  saveWorkspaces,
  captureSettings,
  applySettings,
  newWorkspaceId
} from '../../core/workspaces.js'
import { saveOverrides } from '../../core/shortcuts.js'
import { loadRemoteButtons, applyRemoteButtons } from './RemoteButtonsEditor.js'

export const WORKSPACE_APPLIED_EVENT = 'workspace-applied'

/**
 * WorkspaceMenu — save how the app is set up under a name, and switch between setups.
 * Drawn into `host` (the ⋯ menu beside the control tabs). `onApplied` runs after a
 * layout is applied so the caller can redraw whatever depends on it.
 */
export function renderWorkspaceMenu(host, { onApplied } = {}) {
  let list = loadWorkspaces()
  let note = ''

  const deps = () => ({
    state,
    remoteButtons: loadRemoteButtons(),
    shortcutOverrides: state.get('shortcutOverrides')
  })

  function render() {
    host.innerHTML = ''
    const title = document.createElement('div')
    title.style.cssText = 'font-size:11px;letter-spacing:.08em;text-transform:uppercase;width:100%;'
    title.textContent = 'Saved layouts'
    host.appendChild(title)

    const select = document.createElement('select')
    select.id = 'ws-select'
    select.className = 'input'
    select.style.cssText = 'font-size:12px;min-width:140px;min-height:26px;'
    select.setAttribute('aria-label', 'Saved layouts')
    select.innerHTML = '<option value="">Choose a saved layout…</option>'
    for (const w of list) {
      const o = document.createElement('option')
      o.value = w.id
      o.textContent = w.name
      select.appendChild(o)
    }

    const button = (id, text, onClick, title) => {
      const b = document.createElement('button')
      b.id = id
      b.className = 'btn'
      b.textContent = text
      b.title = title
      b.style.cssText = 'font-size:12px;padding:2px 10px;min-height:26px;'
      b.addEventListener('click', onClick)
      return b
    }

    const apply = button('ws-apply', 'Apply', () => {
      const chosen = list.find((w) => w.id === select.value)
      if (!chosen) return setNote('Choose a layout first.')
      applySettings(chosen.settings, {
        state,
        applyRemoteButtons: (buttons) => applyRemoteButtons(buttons),
        applyShortcuts: (overrides) => {
          state.set('shortcutOverrides', overrides)
          saveOverrides(overrides)
        }
      })
      window.dispatchEvent(new window.CustomEvent(WORKSPACE_APPLIED_EVENT))
      setNote(`Applied “${chosen.name}”.`)
      onApplied?.()
    }, 'Switch to this layout')

    const del = button('ws-delete', 'Delete', () => {
      const chosen = list.find((w) => w.id === select.value)
      if (!chosen) return setNote('Choose a layout first.')
      list = list.filter((w) => w.id !== chosen.id)
      saveWorkspaces(list)
      setNote(`Deleted “${chosen.name}”.`)
    }, 'Delete the chosen layout')

    const name = document.createElement('input')
    name.id = 'ws-name'
    name.className = 'input'
    name.placeholder = 'Name this layout'
    name.maxLength = 40
    name.style.cssText = 'font-size:12px;width:140px;min-height:26px;'
    name.setAttribute('aria-label', 'Layout name')

    const save = button('ws-save', 'Save current', () => {
      const text = name.value.trim()
      if (!text) {
        name.focus()
        return setNote('Type a name first.')
      }
      const settings = captureSettings(deps())
      const existing = list.find((w) => w.name.toLowerCase() === text.toLowerCase())
      list = existing
        ? list.map((w) => (w.id === existing.id ? { ...w, name: text, settings } : w))
        : [...list, { id: newWorkspaceId(), name: text, settings }]
      saveWorkspaces(list)
      list = loadWorkspaces() // what was really kept (the list is capped)
      setNote(existing ? `Updated “${text}”.` : `Saved “${text}”.`)
    }, 'Save the current tabs, panel widths, transition, remote buttons and shortcuts under this name')

    const status = document.createElement('div')
    status.id = 'ws-note'
    status.setAttribute('role', 'status')
    status.style.cssText = 'font-size:11px;width:100%;min-height:1.3em;'
    status.textContent = note

    host.append(select, apply, del, name, save, status)
  }

  function setNote(text) {
    note = text
    render()
  }

  render()
}
