import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { state } from '../../core/StateManager.js'
import { renderWorkspaceMenu, WORKSPACE_APPLIED_EVENT } from './WorkspaceMenu.js'
import { ShowControls } from './ShowControls.js'
import { WORKSPACES_KEY } from '../../core/workspaces.js'
import { REMOTE_BUTTONS_KEY, applyRemoteButtons } from './RemoteButtonsEditor.js'
import { SHORTCUTS_KEY } from '../../core/shortcuts.js'

let host
const q = (sel) => host.querySelector(sel)
const stored = () => JSON.parse(localStorage.getItem(WORKSPACES_KEY))
const type = (text) => {
  q('#ws-name').value = text
}
const choose = (id) => {
  q('#ws-select').value = id
}

beforeEach(() => {
  localStorage.clear()
  document.body.innerHTML = '<div id="panel-left" style="width: 300px"></div><div id="panel-right" style="width: 420px"></div>'
  state.set('hiddenControlTabs', [])
  state.set('activeControlTab', 'timers')
  state.set('outputTransition', 'cut')
  state.set('outputTransitionMs', 400)
  state.set('hideAudienceSlide', false)
  state.set('shortcutOverrides', {})
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => host.remove())

describe('WorkspaceMenu', () => {
  it('needs a name to save', () => {
    renderWorkspaceMenu(host)
    q('#ws-save').click()
    expect(q('#ws-note').textContent).toContain('Type a name')
    expect(localStorage.getItem(WORKSPACES_KEY)).toBeNull()
  })

  it('saves the current setup under a name and lists it', () => {
    state.set('hiddenControlTabs', ['macros'])
    state.set('outputTransition', 'wipe')
    renderWorkspaceMenu(host)
    type('Camp night')
    q('#ws-save').click()
    expect(stored()).toHaveLength(1)
    expect(stored()[0].name).toBe('Camp night')
    expect(stored()[0].settings).toMatchObject({ hiddenControlTabs: ['macros'], outputTransition: 'wipe', panelWidths: { left: 300, right: 420 } })
    expect([...host.querySelectorAll('#ws-select option')].map((o) => o.textContent)).toEqual(['Choose a saved layout…', 'Camp night'])
  })

  it('saving under an existing name updates it instead of adding another', () => {
    renderWorkspaceMenu(host)
    type('Sunday')
    q('#ws-save').click()
    state.set('outputTransition', 'dissolve')
    type('sunday')
    q('#ws-save').click()
    expect(stored()).toHaveLength(1)
    expect(stored()[0].settings.outputTransition).toBe('dissolve')
    expect(q('#ws-note').textContent).toContain('Updated')
  })

  it('applies a layout: state, panel widths, remote buttons and shortcuts follow it', () => {
    applyRemoteButtons([{ cmd: 'logo', label: 'Welcome', big: true }])
    state.set('shortcutOverrides', { logo: ['l'] })
    state.set('hideAudienceSlide', true)
    state.set('hiddenControlTabs', ['game'])
    renderWorkspaceMenu(host)
    type('Sermon')
    q('#ws-save').click()

    // Drift away from it
    applyRemoteButtons([{ cmd: 'next', label: 'Go', big: false }])
    state.set('shortcutOverrides', {})
    state.set('hideAudienceSlide', false)
    state.set('hiddenControlTabs', [])
    document.getElementById('panel-left').style.width = '200px'

    let heard = false
    window.addEventListener(WORKSPACE_APPLIED_EVENT, () => (heard = true), { once: true })
    choose(stored()[0].id)
    q('#ws-apply').click()

    expect(state.get('hideAudienceSlide')).toBe(true)
    expect(state.get('hiddenControlTabs')).toEqual(['game'])
    expect(state.get('shortcutOverrides')).toEqual({ logo: ['l'] })
    expect(JSON.parse(localStorage.getItem(SHORTCUTS_KEY))).toEqual({ logo: ['l'] })
    expect(JSON.parse(localStorage.getItem(REMOTE_BUTTONS_KEY))[0]).toEqual({ cmd: 'logo', label: 'Welcome', big: true })
    expect(document.getElementById('panel-left').style.width).toBe('300px')
    expect(heard).toBe(true)
  })

  it('asks you to choose before applying or deleting', () => {
    renderWorkspaceMenu(host)
    q('#ws-apply').click()
    expect(q('#ws-note').textContent).toContain('Choose a layout')
    q('#ws-delete').click()
    expect(q('#ws-note').textContent).toContain('Choose a layout')
  })

  it('deletes a layout', () => {
    renderWorkspaceMenu(host)
    type('Temp')
    q('#ws-save').click()
    choose(stored()[0].id)
    q('#ws-delete').click()
    expect(stored()).toEqual([])
    expect(q('#ws-select').options).toHaveLength(1)
  })

  it('layouts saved earlier are there next time', () => {
    renderWorkspaceMenu(host)
    type('Kept')
    q('#ws-save').click()
    host.innerHTML = ''
    renderWorkspaceMenu(host)
    expect(q('#ws-select').textContent).toContain('Kept')
  })
})

describe('ShowControls — layouts in the ⋯ menu', () => {
  it('applying a layout redraws the tabs', () => {
    state.set('hiddenControlTabs', [])
    const box = document.createElement('div')
    document.body.appendChild(box)
    const controls = new ShowControls(box)
    box.querySelector('#control-tabs-customize').click()
    expect(box.querySelector('#control-layouts')).not.toBeNull()

    // A layout that hides the Game tab
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify([{ id: 'w1', name: 'No game', settings: { hiddenControlTabs: ['game'] } }]))
    box.querySelector('#control-tabs-customize').click() // close
    box.querySelector('#control-tabs-customize').click() // reopen, now sees the saved layout
    box.querySelector('#ws-select').value = 'w1'
    box.querySelector('#ws-apply').click()

    expect(box.querySelector('[data-tab="game"]')).toBeNull()
    expect(box.querySelector('#control-tabs-menu')).not.toBeNull() // the menu stays open
    controls._tabCleanup?.()
    box.remove()
  })
})
