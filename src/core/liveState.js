/**
 * liveState — the lightweight "what is happening now" snapshot shared with
 * the presenter and PA views (served over the stage socket server).
 *
 * Deliberately text-only: slides can carry multi-MB base64 backgrounds that
 * must never be pushed over Wi-Fi on every slide advance.
 */
import { getActiveSequence } from './arrangement.js'

const slideInfo = (slide) => (slide ? { label: slide.label || '', text: slide.text || '' } : null)

/** The title of the song after `currentId` in the open setlist, or '' (last song, or not in the list). */
export function nextSongTitle(playlist, presentations, currentId) {
  const songs = ((playlist && playlist.items) || [])
    .filter((item) => item.type === 'presentation')
    .map((item) => (presentations || []).find((p) => p.id === item.id))
    .filter(Boolean)
  const at = songs.findIndex((p) => p.id === currentId)
  const next = at === -1 ? null : songs[at + 1]
  return next ? next.title || next.name || '' : ''
}

export function buildLiveState({ presentation, liveIndex, layers, showLogo, timerValue, nextSong }) {
  const sequence = presentation ? getActiveSequence(presentation) : []
  const slideLayer = layers?.slide
  const messageLayer = layers?.message

  const onAir = !!(slideLayer && slideLayer.active && slideLayer.content)
  const current = onAir ? slideLayer.content : null
  const hasIndex = Number.isInteger(liveIndex) && liveIndex >= 0 && liveIndex < sequence.length

  let message = null
  if (messageLayer?.active && messageLayer.content) {
    message = String(messageLayer.content).replace('{timer}', timerValue || '00:00')
  }

  return {
    title: presentation?.title || presentation?.name || '',
    onAir,
    current: slideInfo(current),
    next: onAir && hasIndex ? slideInfo(sequence[liveIndex + 1]) : null,
    index: onAir && hasIndex ? liveIndex : null,
    total: sequence.length,
    message,
    showLogo: !!showLogo,
    timer: timerValue || '',
    nextSong: nextSong || ''
  }
}
