/**
 * remoteButtons — which buttons the phone remote shows, and what each may do.
 *
 * The operator chooses, labels and orders them; the remote page just draws what it is told.
 * COMMANDS is the whole of what a phone can ask for: nothing outside it is ever relayed.
 */
const COMMANDS = ['next', 'prev', 'clear', 'logo', 'nextSong', 'prevSong', 'clearSlide', 'hideAudienceText']

const DEFAULT_LABELS = {
  next: 'Next ▶',
  prev: '◀ Back',
  clear: 'Clear',
  logo: 'Logo',
  nextSong: 'Next song',
  prevSong: 'Previous song',
  clearSlide: 'Clear slide',
  hideAudienceText: 'Hide text'
}

const MAX_BUTTONS = 8

const defaultButtons = () => [
  { cmd: 'prev', label: DEFAULT_LABELS.prev, big: true },
  { cmd: 'next', label: DEFAULT_LABELS.next, big: true },
  { cmd: 'clear', label: DEFAULT_LABELS.clear, big: false },
  { cmd: 'logo', label: DEFAULT_LABELS.logo, big: false }
]

/** A clean button list from anything: known commands only, one button each, trimmed labels, at most 8; the defaults if nothing is left. */
function sanitizeButtons(raw) {
  if (!Array.isArray(raw)) return defaultButtons()
  const seen = new Set()
  const out = []
  for (const b of raw) {
    if (!b || !COMMANDS.includes(b.cmd) || seen.has(b.cmd)) continue
    seen.add(b.cmd)
    const label = typeof b.label === 'string' ? b.label.trim().slice(0, 20) : ''
    out.push({ cmd: b.cmd, label: label || DEFAULT_LABELS[b.cmd], big: !!b.big })
    if (out.length >= MAX_BUTTONS) break
  }
  return out.length ? out : defaultButtons()
}

module.exports = { COMMANDS, DEFAULT_LABELS, MAX_BUTTONS, defaultButtons, sanitizeButtons }
