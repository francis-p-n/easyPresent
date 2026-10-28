import { state } from '../../core/StateManager.js'
import {
  SHORTCUT_ACTIONS,
  effectiveBindings,
  bindKey,
  resetAction,
  eventToSpec,
  describeSpec,
  saveOverrides
} from '../../core/shortcuts.js'

/**
 * ShortcutHelp — the keyboard cheat sheet, and where the keys are changed.
 * Open it with "?" or the "?" toolbar button. Every row can be re-bound: "Set key" waits for
 * the next key press and makes it the only key for that action, "+" adds another key,
 * and "Default" puts the original keys back.
 */
const FIXED_ROWS = [
  ['1 – 9', 'Go to that slide (type two digits quickly for 10 and up, e.g. 1 then 2 = slide 12)'],
  ['Enter', 'Take the focused slide or song live (Tab to reach it)']
]

export function showShortcutHelp() {
  document.getElementById('shortcut-help-overlay')?.remove()

  let listening = null // { action, append } while waiting for a key
  let note = ''

  const overlay = document.createElement('div')
  overlay.id = 'shortcut-help-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;'

  const box = document.createElement('div')
  box.style.cssText =
    'background:var(--bg-panel);border-radius:10px;padding:20px;width:640px;max-width:94vw;max-height:88vh;overflow:auto;border:1px solid var(--border-color);display:flex;flex-direction:column;gap:10px;'
  overlay.append(box)

  const setOverrides = (next) => {
    state.set('shortcutOverrides', next)
    saveOverrides(next)
  }

  const nameOf = (id) => SHORTCUT_ACTIONS.find((a) => a.id === id)?.label || id

  function render() {
    box.innerHTML = ''
    const heading = document.createElement('h3')
    heading.style.cssText = 'margin:0;font-size:16px;color:var(--text-primary);'
    heading.textContent = 'Keyboard shortcuts'
    box.append(heading)

    const hint = document.createElement('div')
    hint.id = 'shortcut-hint'
    hint.style.cssText = 'font-size:12px;color:var(--text-secondary);min-height:1.4em;'
    hint.textContent = listening
      ? `Press the key for “${nameOf(listening.action)}” (Esc to cancel)…`
      : note || 'Change a shortcut with Set key, or add another key with +.'
    box.append(hint)

    const bindings = effectiveBindings(state.get('shortcutOverrides'))
    for (const action of SHORTCUT_ACTIONS) {
      const row = document.createElement('div')
      row.dataset.action = action.id
      row.style.cssText = 'display:flex;gap:10px;align-items:center;font-size:13px;'

      const label = document.createElement('span')
      label.style.cssText = 'flex:1;color:var(--text-secondary);min-width:0;'
      label.textContent = action.label

      const keys = document.createElement('span')
      keys.className = 'shortcut-keys'
      keys.style.cssText = 'flex:1;font-weight:600;color:var(--text-primary);'
      keys.style.cssText += 'display:flex;flex-wrap:wrap;gap:4px;'
      if (bindings[action.id].length) {
        for (const spec of bindings[action.id]) {
          const chip = document.createElement('kbd')
          chip.textContent = describeSpec(spec)
          chip.style.cssText = 'font-family:inherit;font-size:12px;padding:1px 6px;border:1px solid var(--border-color);border-radius:4px;background:var(--bg-active);'
          keys.appendChild(chip)
        }
      } else {
        keys.textContent = '(no key)'
        keys.style.fontWeight = '400'
      }

      const isListening = listening && listening.action === action.id
      const mk = (text, cls, onClick, title) => {
        const b = document.createElement('button')
        b.className = `btn ${cls}`
        b.textContent = text
        b.title = title
        b.style.cssText = 'font-size:12px;padding:2px 10px;min-height:26px;'
        b.addEventListener('click', onClick)
        return b
      }
      const setBtn = mk(isListening && !listening.append ? 'Press a key…' : 'Set key', 'shortcut-set', () => {
        listening = { action: action.id, append: false }
        render()
      }, 'Make the next key you press the only key for this action')
      const addBtn = mk('+', 'shortcut-add', () => {
        listening = { action: action.id, append: true }
        render()
      }, 'Add another key for this action')
      const resetBtn = mk('Default', 'shortcut-reset', () => {
        setOverrides(resetAction(state.get('shortcutOverrides'), action.id))
        listening = null
        note = `“${action.label}” is back to its original keys.`
        render()
      }, 'Put the original keys back')
      row.append(label, keys, setBtn, addBtn, resetBtn)
      box.append(row)
    }

    const fixedHead = document.createElement('div')
    fixedHead.style.cssText = 'font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);margin-top:6px;'
    fixedHead.textContent = 'Always on'
    box.append(fixedHead)
    for (const [keys, what] of FIXED_ROWS) {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;gap:14px;align-items:baseline;font-size:13px;'
      const k = document.createElement('kbd')
      k.style.cssText = 'min-width:90px;font-family:inherit;font-weight:600;color:var(--text-primary);'
      k.textContent = keys
      const d = document.createElement('span')
      d.style.color = 'var(--text-secondary)'
      d.textContent = what
      row.append(k, d)
      box.append(row)
    }

    const footer = document.createElement('div')
    footer.style.cssText = 'display:flex;gap:10px;justify-content:space-between;margin-top:6px;'
    const resetAll = document.createElement('button')
    resetAll.className = 'btn shortcut-reset-all'
    resetAll.textContent = 'Reset all to default'
    resetAll.addEventListener('click', () => {
      setOverrides({})
      listening = null
      note = 'All shortcuts are back to their original keys.'
      render()
    })
    const close = document.createElement('button')
    close.className = 'btn btn--primary shortcut-close'
    close.textContent = 'Close'
    close.addEventListener('click', closeHelp)
    footer.append(resetAll, close)
    box.append(footer)
  }

  // While waiting for a key, take it before anything else sees it (capture phase)
  function onKey(e) {
    if (!listening) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeHelp()
      }
      return
    }
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') {
      listening = null
      note = ''
      render()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return // chords are the system's, not the show's
    const spec = eventToSpec(e)
    if (!spec) return // a bare Shift / Ctrl press: keep waiting
    const before = state.get('shortcutOverrides')
    const next = bindKey(before, listening.action, spec, { append: listening.append })
    const stolenFrom = SHORTCUT_ACTIONS.find((a) => a.id !== listening.action && effectiveBindings(before)[a.id].includes(spec))
    setOverrides(next)
    note = `${describeSpec(spec)} now ${listening.append ? 'also ' : ''}does “${nameOf(listening.action)}”` + (stolenFrom ? ` (it no longer does “${stolenFrom.label}”).` : '.')
    listening = null
    render()
  }

  function closeHelp() {
    document.removeEventListener('keydown', onKey, true)
    overlay.remove()
  }

  render()
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeHelp()
  })
  document.addEventListener('keydown', onKey, true)
  document.body.append(overlay)
  box.querySelector('.shortcut-close')?.focus()
}
