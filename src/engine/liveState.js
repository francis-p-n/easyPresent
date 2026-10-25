/**
 * liveState — the lightweight "what is happening now" snapshot shared with
 * the presenter and PA views (served over the stage socket server).
 *
 * Deliberately text-only: slides can carry multi-MB base64 backgrounds that
 * must never be pushed over Wi-Fi on every slide advance.
 */
import { getActiveSequence } from './arrangement.js'

const slideInfo = (slide) => (slide ? { label: slide.label || '', text: slide.text || '' } : null)

export function buildLiveState({ presentation, liveIndex, layers, showLogo, timerValue }) {
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
    timer: timerValue || ''
  }
}
