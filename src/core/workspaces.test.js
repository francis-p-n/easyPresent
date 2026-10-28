import { describe, it, expect, beforeEach } from 'vitest'
import {
  readPanelWidths,
  applyPanelWidths,
  loadPanelWidths,
  savePanelWidths,
  sanitizeSettings,
  sanitizeWorkspaces,
  loadWorkspaces,
  saveWorkspaces,
  captureSettings,
  applySettings,
  MAX_WORKSPACES,
  WORKSPACES_KEY
} from './workspaces.js'

const fakeState = (init = {}) => {
  const data = { ...init }
  return { get: (k) => data[k], set: (k, v) => (data[k] = v), data }
}
const memory = () => {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }
}

beforeEach(() => {
  document.body.innerHTML = '<div id="panel-left" style="width: 300px"></div><div id="panel-right" style="width: 420px"></div>'
})

describe('panel widths', () => {
  it('reads the current widths and ignores a panel that has none', () => {
    expect(readPanelWidths()).toEqual({ left: 300, right: 420 })
    document.getElementById('panel-right').style.width = ''
    expect(readPanelWidths()).toEqual({ left: 300, right: null })
    document.body.innerHTML = ''
    expect(readPanelWidths()).toEqual({ left: null, right: null })
  })

  it('applies widths, clamped to a sane range', () => {
    applyPanelWidths({ left: 5000, right: 10 })
    expect(document.getElementById('panel-left').style.width).toBe('900px')
    expect(document.getElementById('panel-right').style.width).toBe('160px')
    applyPanelWidths({ left: 'junk', right: null })
    expect(document.getElementById('panel-left').style.width).toBe('900px') // untouched
  })

  it('round-trips through storage and survives junk', () => {
    const s = memory()
    savePanelWidths({ left: 280, right: 'x' }, s)
    expect(loadPanelWidths(s)).toEqual({ left: 280, right: null })
    s.setItem('easyPresentPanelWidths', '{no')
    expect(loadPanelWidths(s)).toEqual({ left: null, right: null })
  })
})

describe('sanitizeSettings', () => {
  it('keeps valid values and drops everything else', () => {
    const out = sanitizeSettings({
      hiddenControlTabs: ['game', 5],
      activeControlTab: 'stage',
      outputTransition: 'spin',
      outputTransitionMs: 99999,
      hideAudienceSlide: 'yes',
      evil: 1
    })
    expect(out).toEqual({ hiddenControlTabs: ['game'], activeControlTab: 'stage', outputTransitionMs: 3000 })
    expect(sanitizeSettings(null)).toEqual({})
  })
})

describe('sanitizeWorkspaces', () => {
  it('needs an id, trims names, drops duplicates and caps the count', () => {
    const list = [{ id: 'a', name: '  Camp  ' }, { id: 'a', name: 'dup' }, { name: 'no id' }, null, { id: 'b', name: '' }]
    expect(sanitizeWorkspaces(list)).toEqual([
      { id: 'a', name: 'Camp', settings: {} },
      { id: 'b', name: 'Untitled', settings: {} }
    ])
    const many = Array.from({ length: 50 }, (_, i) => ({ id: 'w' + i, name: 'n' }))
    expect(sanitizeWorkspaces(many)).toHaveLength(MAX_WORKSPACES)
    expect(sanitizeWorkspaces('x')).toEqual([])
  })

  it('round-trips through storage', () => {
    const s = memory()
    saveWorkspaces([{ id: 'a', name: 'Camp', settings: { outputTransition: 'wipe' } }], s)
    expect(loadWorkspaces(s)).toEqual([{ id: 'a', name: 'Camp', settings: { outputTransition: 'wipe' } }])
    s.setItem(WORKSPACES_KEY, '{bad')
    expect(loadWorkspaces(s)).toEqual([])
  })
})

describe('capture and apply', () => {
  it('captures the setup and applies it back, including panel widths and the two outside lists', () => {
    const st = fakeState({
      hiddenControlTabs: ['macros'],
      activeControlTab: 'game',
      outputTransition: 'dissolve',
      outputTransitionMs: 600,
      hideAudienceSlide: true
    })
    const remoteButtons = [{ cmd: 'next', label: 'Go', big: true }]
    const shortcutOverrides = { logo: ['l'] }
    const snap = captureSettings({ state: st, remoteButtons, shortcutOverrides })
    expect(snap.panelWidths).toEqual({ left: 300, right: 420 })

    // Change everything, then apply the snapshot
    const other = fakeState({ hiddenControlTabs: [], activeControlTab: 'timers', outputTransition: 'cut', outputTransitionMs: 100, hideAudienceSlide: false })
    document.getElementById('panel-left').style.width = '200px'
    const storage = memory()
    const applied = { remote: null, keys: null }
    applySettings(snap, {
      state: other,
      storage,
      applyRemoteButtons: (l) => (applied.remote = l),
      applyShortcuts: (o) => (applied.keys = o)
    })
    expect(other.data).toMatchObject({ hiddenControlTabs: ['macros'], activeControlTab: 'game', outputTransition: 'dissolve', outputTransitionMs: 600, hideAudienceSlide: true })
    expect(document.getElementById('panel-left').style.width).toBe('300px')
    expect(JSON.parse(storage.getItem('easyPresentHiddenTabs'))).toEqual(['macros'])
    expect(JSON.parse(storage.getItem('easyPresentPanelWidths'))).toEqual({ left: 300, right: 420 })
    expect(applied).toEqual({ remote: remoteButtons, keys: shortcutOverrides })
  })

  it('only touches what the workspace holds', () => {
    const st = fakeState({ outputTransition: 'cut', hideAudienceSlide: true })
    applySettings({ outputTransition: 'wipe' }, { state: st, storage: memory() })
    expect(st.data).toEqual({ outputTransition: 'wipe', hideAudienceSlide: true })
  })

  it('does not choke when the optional appliers are missing or the settings are junk', () => {
    const st = fakeState()
    expect(() => applySettings({ remoteButtons: [{ cmd: 'next' }], shortcutOverrides: { a: ['b'] } }, { state: st, storage: memory() })).not.toThrow()
    expect(() => applySettings(null, { state: st, storage: memory() })).not.toThrow()
  })
})
