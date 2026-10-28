/**
 * workspaces — named snapshots of how the operator has set the app up.
 *
 * A workspace remembers the customizable bits: which control tabs show, the audience
 * transition and "hide slide text" look, the width of the side panels, the phone
 * remote's buttons and the keyboard shortcuts. Applying one sets them all at once, so a
 * camp night, a Sunday service and a rehearsal can each be one click away. Nothing about the
 * show's content (songs, setlists, slides) is part of a workspace.
 */

export const WORKSPACES_KEY = 'easyPresentWorkspaces'
export const PANEL_WIDTHS_KEY = 'easyPresentPanelWidths'
export const PANEL_IDS = { left: 'panel-left', right: 'panel-right' }
export const MIN_PANEL = 160
export const MAX_PANEL = 900
export const MAX_WORKSPACES = 20

const TRANSITIONS = ['cut', 'dissolve', 'wipe']

const clampWidth = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.min(MAX_PANEL, Math.max(MIN_PANEL, Math.round(Number(n)))) : null)

/** Panel widths { left, right } from the page (px, null where unknown or unset). */
export function readPanelWidths(doc = document) {
  const width = (id) => {
    const el = doc.getElementById(id)
    return el ? clampWidth(parseFloat(el.style.width)) : null
  }
  return { left: width(PANEL_IDS.left), right: width(PANEL_IDS.right) }
}

export function applyPanelWidths(widths, doc = document) {
  for (const side of ['left', 'right']) {
    const w = clampWidth(widths && widths[side])
    const el = doc.getElementById(PANEL_IDS[side])
    if (w && el) el.style.width = `${w}px`
  }
}

export function loadPanelWidths(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage.getItem(PANEL_WIDTHS_KEY))
    return { left: clampWidth(raw && raw.left), right: clampWidth(raw && raw.right) }
  } catch {
    return { left: null, right: null }
  }
}

export function savePanelWidths(widths, storage = globalThis.localStorage) {
  try {
    storage.setItem(PANEL_WIDTHS_KEY, JSON.stringify({ left: clampWidth(widths && widths.left), right: clampWidth(widths && widths.right) }))
  } catch {
    /* private window */
  }
}

/** Everything a workspace may hold, cleaned: unknown keys dropped, values coerced into range. */
export function sanitizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  if (Array.isArray(s.hiddenControlTabs)) out.hiddenControlTabs = s.hiddenControlTabs.filter((k) => typeof k === 'string').slice(0, 20)
  if (typeof s.activeControlTab === 'string') out.activeControlTab = s.activeControlTab
  if (TRANSITIONS.includes(s.outputTransition)) out.outputTransition = s.outputTransition
  if (Number.isFinite(Number(s.outputTransitionMs))) out.outputTransitionMs = Math.min(3000, Math.max(0, Math.round(Number(s.outputTransitionMs))))
  if (typeof s.hideAudienceSlide === 'boolean') out.hideAudienceSlide = s.hideAudienceSlide
  if (s.panelWidths && typeof s.panelWidths === 'object') out.panelWidths = { left: clampWidth(s.panelWidths.left), right: clampWidth(s.panelWidths.right) }
  if (Array.isArray(s.remoteButtons)) out.remoteButtons = s.remoteButtons
  if (s.shortcutOverrides && typeof s.shortcutOverrides === 'object') out.shortcutOverrides = s.shortcutOverrides
  return out
}

export function sanitizeWorkspaces(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const w of raw) {
    if (!w || typeof w.id !== 'string' || seen.has(w.id)) continue
    seen.add(w.id)
    const name = typeof w.name === 'string' ? w.name.trim().slice(0, 40) : ''
    out.push({ id: w.id, name: name || 'Untitled', settings: sanitizeSettings(w.settings) })
    if (out.length >= MAX_WORKSPACES) break
  }
  return out
}

export function loadWorkspaces(storage = globalThis.localStorage) {
  try {
    return sanitizeWorkspaces(JSON.parse(storage.getItem(WORKSPACES_KEY)))
  } catch {
    return []
  }
}

export function saveWorkspaces(list, storage = globalThis.localStorage) {
  try {
    storage.setItem(WORKSPACES_KEY, JSON.stringify(sanitizeWorkspaces(list)))
  } catch {
    /* private window */
  }
}

/**
 * Captures the current setup. `deps.state` is the app state; `deps.remoteButtons` and
 * `deps.shortcutOverrides` are the current lists (kept outside the state object).
 */
export function captureSettings({ state, doc = document, remoteButtons, shortcutOverrides }) {
  return sanitizeSettings({
    hiddenControlTabs: state.get('hiddenControlTabs'),
    activeControlTab: state.get('activeControlTab'),
    outputTransition: state.get('outputTransition'),
    outputTransitionMs: state.get('outputTransitionMs'),
    hideAudienceSlide: !!state.get('hideAudienceSlide'),
    panelWidths: readPanelWidths(doc),
    remoteButtons,
    shortcutOverrides
  })
}

/**
 * Applies a workspace. Only what the workspace holds is touched. `deps.applyRemoteButtons` and
 * `deps.applyShortcuts` save-and-push those two lists (they live outside the state object).
 */
export function applySettings(settings, { state, doc = document, storage = globalThis.localStorage, applyRemoteButtons, applyShortcuts }) {
  const s = sanitizeSettings(settings)
  for (const key of ['hiddenControlTabs', 'activeControlTab', 'outputTransition', 'outputTransitionMs', 'hideAudienceSlide']) {
    if (key in s) state.set(key, s[key])
  }
  if (s.hiddenControlTabs) {
    try {
      storage.setItem('easyPresentHiddenTabs', JSON.stringify(s.hiddenControlTabs))
    } catch {
      /* private window */
    }
  }
  if (s.panelWidths) {
    applyPanelWidths(s.panelWidths, doc)
    savePanelWidths(readPanelWidths(doc), storage)
  }
  if (s.remoteButtons && applyRemoteButtons) applyRemoteButtons(s.remoteButtons)
  if (s.shortcutOverrides && applyShortcuts) applyShortcuts(s.shortcutOverrides)
  return s
}

export const newWorkspaceId = () => 'ws-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
