/**
 * a11y — makes the whole app usable with a keyboard and a screen reader without
 * every panel having to remember to do it itself.
 *
 * installA11y() watches the page and, for whatever appears:
 *   - names icon-only buttons and unlabeled fields (from title / tooltip / placeholder),
 *   - makes slide thumbnails and library/playlist rows focusable and activatable with Enter,
 *   - turns every dialog overlay into a real dialog: role + aria-modal, focus moves in and
 *     is kept inside, Escape closes it, and focus goes back to where it came from.
 */

// Overlays that are modal dialogs (context menus are not)
export const DIALOG_SELECTOR = [
  '.modal-overlay',
  '#template-picker-overlay',
  '#confirm-dialog-overlay',
  '#rename-dialog-overlay',
  '#playlist-prompt-overlay',
  '#playlist-song-picker-overlay',
  '#announcement-editor-overlay',
  '#arrangement-editor-overlay',
  '#theme-editor-overlay',
  '#bible-add-overlay',
  '#shortcut-help-overlay'
].join(', ')

// Rows a keyboard user must be able to reach and press
const ROW_SELECTOR = '.slide-thumbnail, .list-item, .playlist-item'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()

/** The name a screen reader would speak for a control, or ''. */
function accessibleName(el) {
  return (
    el.getAttribute('aria-label') ||
    (el.getAttribute('aria-labelledby') ? 'labelled' : '') ||
    text(el) ||
    el.getAttribute('title') ||
    ''
  )
}

function describeRow(el) {
  if (el.matches('.slide-thumbnail')) {
    const number = text(el.querySelector('.slide-thumbnail__number') || '') || ''
    const label = text(el.querySelector('.slide-thumbnail__label') || '') || ''
    const words = text(el.querySelector('.slide-thumbnail__content') || '')
    return ['Slide', number, label && `(${label})`, words && `: ${words.slice(0, 80)}`].filter(Boolean).join(' ').replace(' :', ':')
  }
  return text(el).slice(0, 100)
}

/** Name unlabeled controls and make rows reachable. Safe to run repeatedly. */
export function labelControls(root) {
  if (!root || root.nodeType !== 1) return
  const nodes = [root, ...root.querySelectorAll('button, select, input, textarea, [role="button"], .slide-thumbnail, .list-item, .playlist-item')]
  for (const el of nodes) {
    if (el.matches?.(ROW_SELECTOR)) {
      if (!el.hasAttribute('tabindex') || el.getAttribute('tabindex') === '-1') el.setAttribute('tabindex', '0')
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button')
      const name = describeRow(el)
      if (name && el.getAttribute('aria-label') !== name) el.setAttribute('aria-label', name)
      continue
    }
    if (!el.matches?.('button, select, input, textarea, [role="button"]')) continue
    if (accessibleName(el)) {
      // Hover tooltip too, for sighted mouse users of icon-only buttons
      if (el.tagName === 'BUTTON' && !el.title && !el.dataset.tooltip && !text(el)) el.title = el.getAttribute('aria-label')
      continue
    }
    const guess =
      el.dataset.tooltip ||
      el.getAttribute('placeholder') ||
      (el.dataset.view && el.dataset.view[0].toUpperCase() + el.dataset.view.slice(1)) ||
      (el.dataset.role && `Display for ${el.dataset.role}`) ||
      el.id?.replace(/[-_]+/g, ' ')
    if (guess) {
      el.setAttribute('aria-label', guess)
      if (el.tagName === 'BUTTON' && !el.title && !el.dataset.tooltip) el.title = guess
    }
  }
  // Toolbar view buttons keep their visible word in the DOM even when it is hidden to save space
  root.querySelectorAll?.('.toolbar-view-btn').forEach((b) => {
    const word = text(b.querySelector('.toolbar-btn-label') || '')
    if (word) {
      b.setAttribute('aria-label', word)
      if (!b.title) b.title = word
    }
  })
}

// Not hidden by display:none anywhere up the tree (offsetParent is unreliable for fixed overlays and in tests)
const isVisible = (el) => !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden'

const openers = new Map() // dialog element -> the element that had focus before it opened

// The last thing focused outside any dialog. A dialog often grabs focus itself before this layer
// notices it, so by then document.activeElement is already inside the dialog and is no use for
// returning focus afterwards.
let lastOutsideFocus = null
const noteFocus = (e) => {
  if (e.target?.closest && !e.target.closest(DIALOG_SELECTOR)) lastOutsideFocus = e.target
}

/** Gives a dialog overlay dialog behaviour. */
export function enhanceDialog(overlay) {
  if (overlay.dataset.a11y === 'dialog') return
  overlay.dataset.a11y = 'dialog'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  if (!overlay.getAttribute('aria-label')) {
    const heading = overlay.querySelector('h1, h2, h3, [class*="title"]')
    overlay.setAttribute('aria-label', heading ? text(heading) : 'Dialog')
  }
  const active = document.activeElement
  openers.set(overlay, active && !overlay.contains(active) ? active : lastOutsideFocus)

  const focusables = () => [...overlay.querySelectorAll(FOCUSABLE)].filter(isVisible)
  if (!overlay.contains(document.activeElement)) {
    const first = overlay.querySelector('input, textarea, select') || focusables()[0]
    first?.focus?.()
  }

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      // Prefer the dialog's own Cancel / Close so it can clean up; otherwise just remove it
      const close = [...overlay.querySelectorAll('button')].find((b) => /^(cancel|close|done|get started)$/i.test(text(b)) || b.getAttribute('aria-label') === 'Close')
      if (close) close.click()
      else overlay.remove()
    } else if (e.key === 'Tab') {
      const list = focusables()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
        e.preventDefault()
        first.focus()
      }
    }
  })
}

function onAdded(node) {
  if (node.nodeType !== 1) return
  if (node.matches(DIALOG_SELECTOR)) {
    labelControls(node)
    enhanceDialog(node)
  } else {
    labelControls(node)
  }
}

function onRemoved(node) {
  if (node.nodeType !== 1 || !openers.has(node)) return
  const opener = openers.get(node)
  openers.delete(node)
  if (opener && document.contains(opener)) opener.focus?.()
}

/** Start watching the page. Returns a function that stops it. */
export function installA11y(doc = document) {
  labelControls(doc.body)
  const observer = new window.MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(onAdded)
      m.removedNodes.forEach(onRemoved)
    }
  })
  observer.observe(doc.body, { childList: true, subtree: true })

  // Enter presses the focused row (slide, song, playlist entry). Space stays "next slide" for the show.
  const onKey = (e) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return
    const row = e.target.closest?.(ROW_SELECTOR)
    if (row && row === e.target) {
      e.preventDefault()
      row.click()
    }
  }
  doc.addEventListener('keydown', onKey)
  doc.addEventListener('focusin', noteFocus)
  return () => {
    observer.disconnect()
    doc.removeEventListener('keydown', onKey)
    doc.removeEventListener('focusin', noteFocus)
  }
}
