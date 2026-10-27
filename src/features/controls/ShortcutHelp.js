/**
 * ShortcutHelp — the keyboard cheat sheet. Open it with "?" or the "?" toolbar button.
 */
const SECTIONS = [
  {
    title: 'Slides',
    rows: [
      ['→  ↓  Page Down  Space', 'Next slide'],
      ['←  ↑  Page Up', 'Previous slide'],
      ['1 – 9', 'Go to that slide (type two digits quickly for 10 and up, e.g. 1 then 2 = slide 12)'],
      ['Enter', 'Take the focused slide or song live (Tab to reach it)']
    ]
  },
  {
    title: 'Songs in the setlist',
    rows: [
      ['Shift + →  or  ]', 'Next song, from its first slide'],
      ['Shift + ←  or  [', 'Previous song']
    ]
  },
  {
    title: 'Clear the screens',
    rows: [
      ['F1  or  B  or  Esc', 'Clear everything'],
      ['F2', 'Clear the slide'],
      ['F3  F4  F5', 'Clear media / props / audio'],
      ['F6', 'Logo on or off']
    ]
  },
  { title: 'Help', rows: [['?', 'Show this list']] }
]

export function showShortcutHelp() {
  document.getElementById('shortcut-help-overlay')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'shortcut-help-overlay'
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:2000;display:flex;align-items:center;justify-content:center;'

  const box = document.createElement('div')
  box.style.cssText =
    'background:var(--bg-panel);border-radius:10px;padding:20px;width:520px;max-width:92vw;max-height:88vh;overflow:auto;border:1px solid var(--border-color);display:flex;flex-direction:column;gap:14px;'
  const heading = document.createElement('h3')
  heading.style.cssText = 'margin:0;font-size:16px;color:var(--text-primary);'
  heading.textContent = 'Keyboard shortcuts'
  box.append(heading)

  for (const section of SECTIONS) {
    const h = document.createElement('div')
    h.style.cssText = 'font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-secondary);margin-top:4px;'
    h.textContent = section.title
    box.append(h)
    for (const [keys, what] of section.rows) {
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;gap:14px;align-items:baseline;font-size:13px;'
      const k = document.createElement('kbd')
      k.style.cssText = 'min-width:190px;font-family:inherit;font-weight:600;color:var(--text-primary);'
      k.textContent = keys
      const d = document.createElement('span')
      d.style.color = 'var(--text-secondary)'
      d.textContent = what
      row.append(k, d)
      box.append(row)
    }
  }

  const close = document.createElement('button')
  close.className = 'btn btn--primary'
  close.textContent = 'Close'
  close.style.alignSelf = 'flex-end'
  close.addEventListener('click', () => overlay.remove())
  box.append(close)

  overlay.append(box)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove()
  })
  document.body.append(overlay)
  close.focus()
}
