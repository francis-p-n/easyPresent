/**
 * mediaLibrary — the pictures, videos and audio files the operator has added.
 *
 * Pictures are kept inside the library (so they are saved, backed up and exported with it). Videos
 * and audio stay where they are on this computer: they are too big to copy into the library, so the
 * library remembers their location as a file:// address, the same way video backgrounds do. If a file
 * is moved or deleted its entry stays and simply does not play.
 *
 * A media item is { id, name, type: 'image' | 'video', src }, an audio item is { id, name, src, duration }.
 */

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp']
export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm', 'mov', 'ogv']
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac']
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_ITEMS = 200

const extensionOf = (name) => String(name || '').split('.').pop().toLowerCase()

export const isImageFileName = (name) => IMAGE_EXTENSIONS.includes(extensionOf(name))
export const isVideoFileName = (name) => VIDEO_EXTENSIONS.includes(extensionOf(name))
export const isAudioFileName = (name) => AUDIO_EXTENSIONS.includes(extensionOf(name))

/** "Worship_loop-2.mp4" -> "Worship loop 2" */
export function nameFromFile(fileName) {
  const base = String(fileName || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (base || 'Untitled').slice(0, 80)
}

const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const validSrc = (src, type) =>
  typeof src === 'string' &&
  (type === 'image' ? /^data:image\//.test(src) || /^file:\/\//i.test(src) : /^file:\/\//i.test(src))

/** Keeps only well-formed pictures and videos. */
export function cleanMediaLibrary(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const m of raw) {
    if (!m || (m.type !== 'image' && m.type !== 'video') || !validSrc(m.src, m.type)) continue
    out.push({ id: typeof m.id === 'string' && m.id ? m.id : newId('media'), name: nameFromFile(m.name), type: m.type, src: m.src })
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

/** Keeps only well-formed audio entries. */
export function cleanAudioLibrary(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const a of raw) {
    if (!a || !validSrc(a.src, 'audio')) continue
    const duration = Number(a.duration)
    out.push({
      id: typeof a.id === 'string' && a.id ? a.id : newId('audio'),
      name: nameFromFile(a.name),
      src: a.src,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0
    })
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

export const addMediaItem = (list, item) => cleanMediaLibrary([...(list || []), { ...item, id: item.id || newId('media') }])
export const addAudioItem = (list, item) => cleanAudioLibrary([...(list || []), { ...item, id: item.id || newId('audio') }])
export const removeItem = (list, id) => (list || []).filter((item) => item.id !== id)

/** "3:05" for a length in seconds; blank when it is not known. */
export function formatDuration(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n) || n <= 0) return ''
  const m = Math.floor(n / 60)
  const s = Math.floor(n % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
