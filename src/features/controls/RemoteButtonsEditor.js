/**
 * RemoteButtonsEditor — choose, label, size and order the buttons on the phone remote.
 * The list is kept on this computer and pushed to the web server, which tells every
 * connected remote to redraw. The server re-checks the list, so this is a convenience, not a gate.
 */

export const REMOTE_OPTIONS = [
  { cmd: 'next', label: 'Next ▶' },
  { cmd: 'prev', label: '◀ Back' },
  { cmd: 'clear', label: 'Clear' },
  { cmd: 'logo', label: 'Logo' },
  { cmd: 'nextSong', label: 'Next song' },
  { cmd: 'prevSong', label: 'Previous song' },
  { cmd: 'clearSlide', label: 'Clear slide' },
  { cmd: 'hideAudienceText', label: 'Hide text' }
]

export const REMOTE_BUTTONS_KEY = 'easyPresentRemoteButtons'

export const DEFAULT_REMOTE_BUTTONS = [
  { cmd: 'prev', label: '◀ Back', big: true },
  { cmd: 'next', label: 'Next ▶', big: true },
  { cmd: 'clear', label: 'Clear', big: false },
  { cmd: 'logo', label: 'Logo', big: false }
]

const known = new Set(REMOTE_OPTIONS.map((o) => o.cmd))

export function cleanRemoteButtons(raw) {
  if (!Array.isArray(raw)) return DEFAULT_REMOTE_BUTTONS.map((b) => ({ ...b }))
  const seen = new Set()
  const out = []
  for (const b of raw) {
    if (!b || !known.has(b.cmd) || seen.has(b.cmd)) continue
    seen.add(b.cmd)
    const fallback = REMOTE_OPTIONS.find((o) => o.cmd === b.cmd).label
    out.push({ cmd: b.cmd, label: (typeof b.label === 'string' && b.label.trim().slice(0, 20)) || fallback, big: !!b.big })
  }
  return out.length ? out.slice(0, 8) : DEFAULT_REMOTE_BUTTONS.map((b) => ({ ...b }))
}

export function loadRemoteButtons(storage = globalThis.localStorage) {
  try {
    return cleanRemoteButtons(JSON.parse(storage.getItem(REMOTE_BUTTONS_KEY)))
  } catch {
    return cleanRemoteButtons(null)
  }
}

/** Saves the list on this computer and sends it to the server (if the desktop bridge is there). */
export function applyRemoteButtons(list, { storage = globalThis.localStorage, api = globalThis.window?.electronAPI } = {}) {
  const clean = cleanRemoteButtons(list)
  try {
    storage.setItem(REMOTE_BUTTONS_KEY, JSON.stringify(clean))
  } catch {
    /* private window: lasts until the app closes */
  }
  api?.setRemoteButtons?.(clean)
  return clean
}

/** Draws the editor into `host`. Rows are every possible button: the chosen ones first, in order. */
export function mountRemoteButtonsEditor(host, options = {}) {
  let chosen = loadRemoteButtons(options.storage)

  // Rows in display order: chosen buttons, then the unused ones. `on` marks the chosen.
  const rowsFor = () => [
    ...chosen.map((b) => ({ ...b, on: true })),
    ...REMOTE_OPTIONS.filter((o) => !chosen.some((b) => b.cmd === o.cmd)).map((o) => ({ cmd: o.cmd, label: o.label, big: false, on: false }))
  ]

  function commit(rows) {
    const next = rows.filter((r) => r.on)
    if (!next.length) return render() // a remote with no buttons is useless; keep the last one
    chosen = applyRemoteButtons(next, options)
    render()
  }

  function render() {
    host.innerHTML = ''
    const head = document.createElement('div')
    head.style.cssText = 'display:flex;gap:4px;font-size:12px;opacity:.75;margin-bottom:2px;'
    head.setAttribute('aria-hidden', 'true')
    head.innerHTML = '<span style="width:16px;">On</span><span style="flex:1;">Label</span><span style="width:34px;">Large</span><span style="width:50px;">Order</span>'
    host.appendChild(head)
    const rows = rowsFor()
    rows.forEach((row, i) => {
      const el = document.createElement('div')
      el.dataset.cmd = row.cmd
      el.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;margin:2px 0;'

      const on = document.createElement('input')
      on.type = 'checkbox'
      on.className = 'rb-on'
      on.checked = row.on
      on.setAttribute('aria-label', `Show ${REMOTE_OPTIONS.find((o) => o.cmd === row.cmd).label} on the remote`)
      on.addEventListener('change', () => {
        rows[i] = { ...row, on: on.checked }
        commit(rows)
      })

      const label = document.createElement('input')
      label.type = 'text'
      label.className = 'input rb-label'
      label.value = row.label
      label.maxLength = 20
      label.disabled = !row.on
      label.style.cssText = 'flex:1;min-width:0;font-size:12px;'
      label.addEventListener('change', () => {
        rows[i] = { ...row, label: label.value }
        commit(rows)
      })

      const big = document.createElement('input')
      big.type = 'checkbox'
      big.className = 'rb-big'
      big.checked = row.big
      big.disabled = !row.on
      big.title = 'Large button'
      big.setAttribute('aria-label', 'Large button')
      big.addEventListener('change', () => {
        rows[i] = { ...row, big: big.checked }
        commit(rows)
      })

      const move = (delta, text, cls) => {
        const b = document.createElement('button')
        b.className = `btn ${cls}`
        b.textContent = text
        b.disabled = !row.on || i + delta < 0 || i + delta >= chosen.length
        b.style.cssText = 'font-size:12px;padding:0 6px;min-width:22px;'
        b.setAttribute('aria-label', delta < 0 ? 'Move up' : 'Move down')
        b.addEventListener('click', () => {
          const next = [...rows]
          ;[next[i], next[i + delta]] = [next[i + delta], next[i]]
          commit(next)
        })
        return b
      }

      el.append(on, label, big, move(-1, '↑', 'rb-up'), move(1, '↓', 'rb-down'))
      host.appendChild(el)
    })
  }

  render()
  return { refresh: () => ((chosen = loadRemoteButtons(options.storage)), render()) }
}

/** Sends the saved list to the server; call once the app starts so a freshly opened remote already has it. */
export function syncRemoteButtons() {
  globalThis.window?.electronAPI?.setRemoteButtons?.(loadRemoteButtons())
}
