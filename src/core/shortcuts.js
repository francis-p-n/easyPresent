/**
 * shortcuts — the show's keyboard bindings, with the operator's own overrides.
 *
 * A key is written as a "spec": the key's name, lower-cased for single characters, and a
 * "Shift+" prefix only for named keys ("Shift+ArrowRight"). A printable key already says
 * whether Shift was held ("?" is a Shift key; "b" and "B" are the same binding).
 * Ctrl/Alt/Meta chords are never show shortcuts (the app blocks them elsewhere).
 */

export const SHORTCUT_ACTIONS = [
  { id: 'next', label: 'Next slide', keys: ['ArrowRight', 'ArrowDown', 'PageDown', ' '] },
  { id: 'prev', label: 'Previous slide', keys: ['ArrowLeft', 'ArrowUp', 'PageUp'] },
  { id: 'nextSong', label: 'Next song', keys: [']', 'Shift+ArrowRight', 'Shift+ArrowDown'] },
  { id: 'prevSong', label: 'Previous song', keys: ['[', 'Shift+ArrowLeft', 'Shift+ArrowUp'] },
  { id: 'clearAll', label: 'Clear everything', keys: ['F1', 'b', '.', 'Escape'] },
  { id: 'clearSlide', label: 'Clear the slide', keys: ['F2'] },
  { id: 'clearMedia', label: 'Clear media', keys: ['F3'] },
  { id: 'clearProps', label: 'Clear props', keys: ['F4'] },
  { id: 'clearAudio', label: 'Clear audio', keys: ['F5'] },
  { id: 'logo', label: 'Logo on / off', keys: ['F6'] },
  { id: 'hideAudienceText', label: 'Hide / show slide text on the audience screen', keys: [] },
  { id: 'help', label: 'Show the shortcut list', keys: ['?'] }
]

export const SHORTCUTS_KEY = 'easyPresentShortcuts'

const KNOWN = new Set(SHORTCUT_ACTIONS.map((a) => a.id))

/** The spec for a keyboard event, or null for a bare modifier / dead key. */
export function eventToSpec(e) {
  const key = e && e.key
  if (typeof key !== 'string' || !key || ['Shift', 'Control', 'Alt', 'Meta', 'Dead', 'Unidentified', 'CapsLock'].includes(key)) return null
  if (key.length === 1) return key.toLowerCase()
  return (e.shiftKey ? 'Shift+' : '') + key
}

/** A readable name for a spec ("Space", "Shift + →", "F1"). */
export function describeSpec(spec) {
  const names = { ' ': 'Space', ArrowRight: '→', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc', PageDown: 'Page Down', PageUp: 'Page Up' }
  const shift = spec.startsWith('Shift+')
  const base = shift ? spec.slice(6) : spec
  const name = names[base] || (base.length === 1 ? base.toUpperCase() : base)
  return (shift ? 'Shift + ' : '') + name
}

/** Keeps only well-formed overrides for known actions: { action: [spec, ...] }. */
export function sanitizeOverrides(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, specs] of Object.entries(raw)) {
    if (!KNOWN.has(id) || !Array.isArray(specs)) continue
    out[id] = [...new Set(specs.filter((s) => typeof s === 'string' && s.length > 0 && s.length <= 24))]
  }
  return out
}

export function loadOverrides(storage = globalThis.localStorage) {
  try {
    return sanitizeOverrides(JSON.parse(storage.getItem(SHORTCUTS_KEY)))
  } catch {
    return {}
  }
}

export function saveOverrides(overrides, storage = globalThis.localStorage) {
  try {
    storage.setItem(SHORTCUTS_KEY, JSON.stringify(sanitizeOverrides(overrides)))
  } catch {
    /* private window: the change lasts until the app closes */
  }
}

/** Every action's keys: the defaults, with any overridden action using only the operator's keys. */
export function effectiveBindings(overrides = {}) {
  const clean = sanitizeOverrides(overrides)
  const out = {}
  for (const a of SHORTCUT_ACTIONS) out[a.id] = clean[a.id] ? [...clean[a.id]] : [...a.keys]
  return out
}

/** spec -> action id. Where two actions claim a key, the operator's override wins over a default. */
export function buildLookup(overrides = {}) {
  const clean = sanitizeOverrides(overrides)
  const lookup = new Map()
  for (const a of SHORTCUT_ACTIONS) if (!clean[a.id]) for (const k of a.keys) lookup.set(k, a.id)
  for (const [id, keys] of Object.entries(clean)) for (const k of keys) lookup.set(k, id)
  return lookup
}

/** Sets `spec` as the only key for `action` (replace) or adds it (append). A key can belong to one action only. */
export function bindKey(overrides, action, spec, { append = false } = {}) {
  if (!KNOWN.has(action) || !spec) return sanitizeOverrides(overrides)
  const bindings = effectiveBindings(overrides)
  const next = {}
  for (const id of Object.keys(bindings)) {
    // Taking a key from another action leaves that action with its remaining keys
    next[id] = id === action ? (append ? [...bindings[id], spec] : [spec]) : bindings[id].filter((k) => k !== spec)
  }
  // Only record what differs from the defaults, so future default changes still reach untouched actions
  const out = {}
  for (const a of SHORTCUT_ACTIONS) {
    const same = a.keys.length === next[a.id].length && a.keys.every((k) => next[a.id].includes(k))
    if (!same) out[a.id] = [...new Set(next[a.id])]
  }
  return out
}

export const resetAction = (overrides, action) => {
  const out = { ...sanitizeOverrides(overrides) }
  delete out[action]
  return out
}
