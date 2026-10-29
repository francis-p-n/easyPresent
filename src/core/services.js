import { normalizeLook, isEmptyLook } from './serviceLook.js'

/**
 * services — the details of a service (a setlist) and the logic behind the Services home page.
 *
 * A setlist is { id, name, items, meta }. `meta` is optional so libraries saved before it existed
 * load unchanged; every reader goes through normalizeMeta. Dates are plain "YYYY-MM-DD" strings
 * (no time zone), so a service never slides to the day before or after on another computer.
 */

export const STATUSES = ['draft', 'ready', 'done']
export const STATUS_LABELS = { draft: 'Draft', ready: 'Ready', done: 'Done' }
export const SERVICE_TYPES = ['Sunday service', 'Youth night', 'Midweek', 'Camp', 'Special event']

/** Text fields a service carries. Order is the order the editor shows them. */
export const META_TEXT_FIELDS = ['type', 'title', 'speaker', 'host', 'scripture', 'team', 'notes']

const MAX_TEXT = { notes: 2000 }
const DEFAULT_MAX = 120
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidDate(value) {
  const m = DATE_RE.exec(String(value || ''))
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

/** Clean, complete metadata: unknown keys dropped, text trimmed and capped, bad dates/times blanked. */
export function normalizeMeta(raw) {
  const m = raw && typeof raw === 'object' ? raw : {}
  const out = {
    date: isValidDate(m.date) ? m.date : '',
    time: TIME_RE.test(String(m.time || '')) ? m.time : '',
    status: STATUSES.includes(m.status) ? m.status : 'draft'
  }
  for (const key of META_TEXT_FIELDS) {
    const limit = MAX_TEXT[key] || DEFAULT_MAX
    out[key] = typeof m[key] === 'string' ? m[key].trim().slice(0, limit) : ''
  }
  if (!isEmptyLook(m.look)) out.look = normalizeLook(m.look)
  return out
}

export const metaOf = (playlist) => normalizeMeta(playlist && playlist.meta)

/** "YYYY-MM-DD" for a local Date. */
export function toDateString(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** `days` after a date string (negative goes back); "" if the date is not valid. */
export function addDays(dateStr, days) {
  if (!isValidDate(dateStr)) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

/** The coming Sunday, or today if it is Sunday: the date a new service most likely has. */
export function nextSunday(from = new Date()) {
  const today = toDateString(from)
  return addDays(today, (7 - from.getDay()) % 7)
}

/** "Sun 3 Mar 2026" for the list; blank dates read "No date". */
export function formatDate(dateStr, locale) {
  if (!isValidDate(dateStr)) return 'No date'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

/** "Sun, Nov 8" for a service name; blank when the date is not valid. */
export function shortDate(dateStr, locale) {
  if (!isValidDate(dateStr)) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Whole days from `today` to the date (0 today, 1 tomorrow, -1 yesterday); null with no date. */
export function daysFrom(dateStr, today) {
  if (!isValidDate(dateStr) || !isValidDate(today)) return null
  const t = (s) => Date.UTC(...s.split('-').map((n, i) => (i === 1 ? +n - 1 : +n)))
  return Math.round((t(dateStr) - t(today)) / 86400000)
}

/** "Today", "Tomorrow", "In 5 days", "3 days ago", or "" with no date. */
export function relativeLabel(dateStr, today) {
  const n = daysFrom(dateStr, today)
  if (n === null) return ''
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  return n > 0 ? `In ${n} days` : `${-n} days ago`
}

/**
 * Splits playlists into what the home page shows: `upcoming` (today and later, soonest first),
 * `past` (earlier, most recent first) and `undated` (no date yet, by name).
 */
export function groupServices(playlists, today) {
  const upcoming = []
  const past = []
  const undated = []
  for (const p of Array.isArray(playlists) ? playlists : []) {
    const date = metaOf(p).date
    if (!date) undated.push(p)
    else if (date >= today) upcoming.push(p)
    else past.push(p)
  }
  const byDate = (a, b) => metaOf(a).date.localeCompare(metaOf(b).date) || metaOf(a).time.localeCompare(metaOf(b).time)
  upcoming.sort(byDate)
  past.sort((a, b) => byDate(b, a))
  undated.sort((a, b) => String(a.name).localeCompare(String(b.name)))
  return { upcoming, past, undated }
}

/** Services whose name or any detail contains every word typed (case-insensitive). */
export function filterServices(playlists, query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return playlists
  return playlists.filter((p) => {
    const m = metaOf(p)
    const hay = [p.name, m.date, m.type, m.title, m.speaker, m.host, m.scripture, m.team].join(' ').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

/** Number of songs (not headers or notes) in a service. */
export const songCount = (playlist) => (playlist.items || []).filter((i) => i.type === 'presentation').length

/**
 * What next week's service starts as: the same songs and team a week later, with the things that
 * change every week (speaker, title, scripture, notes) cleared and the status back to draft.
 */
export function carryForwardMeta(meta, days = 7) {
  const m = normalizeMeta(meta)
  return { ...m, date: addDays(m.date, days), speaker: '', title: '', scripture: '', notes: '', status: 'draft' }
}

/** The service to open on startup: today's, else the next one coming, else null. */
export function nextService(playlists, today) {
  const { upcoming } = groupServices(playlists, today)
  return upcoming[0] || null
}
