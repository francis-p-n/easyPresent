/**
 * videoBackground — a looping video behind a slide's text.
 *
 * The video stays a file on this computer (video is too big to keep inside the library); the slide
 * remembers its location as a file:// address. The browser engine inside the app plays MP4 (H.264),
 * WebM and similar files itself, so no extra decoder is needed. If the file is moved or deleted the
 * slide simply shows its background colour.
 */

export const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'webm', 'mov', 'ogv']

export const isVideoFileName = (name) => VIDEO_EXTENSIONS.includes(String(name || '').split('.').pop().toLowerCase())

/** "C:\Videos\loop 1.mp4" -> "file:///C:/Videos/loop%201.mp4" */
export function fileUrlFromPath(filePath) {
  if (typeof filePath !== 'string' || !filePath) return null
  if (/^file:\/\//i.test(filePath)) return filePath
  const slashed = filePath.replace(/\\/g, '/')
  const withRoot = /^[A-Za-z]:/.test(slashed) ? `/${slashed}` : slashed.startsWith('/') ? slashed : `/${slashed}`
  return 'file://' + withRoot.split('/').map((part, i) => (i === 1 && /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part))).join('/')
}

/** The file name shown to the operator: "loop 1.mp4". */
export function videoLabel(url) {
  try {
    return decodeURIComponent(String(url).split('/').pop() || '')
  } catch {
    return String(url).split('/').pop() || ''
  }
}

export const isVideoBackground = (bg) => !!bg && bg.type === 'video' && typeof bg.mediaPath === 'string' && bg.mediaPath.length > 0

/**
 * Puts the background video behind everything else in `host`, or removes it. An element for the
 * same file that is already playing is kept (so moving to the next slide does not restart the loop).
 * `keep` is that existing element if the caller detached it while redrawing.
 */
export function placeBackgroundVideo(host, bg, id = 'output-bg-video', keep = host.querySelector(`#${id}`)) {
  if (!isVideoBackground(bg)) {
    keep?.remove()
    return null
  }
  if (keep && keep.getAttribute('src') === bg.mediaPath) {
    if (keep.parentNode !== host) host.insertBefore(keep, host.firstChild)
    return keep
  }
  keep?.remove()
  const video = host.ownerDocument.createElement('video')
  video.id = id
  video.setAttribute('src', bg.mediaPath)
  video.muted = true
  video.loop = true
  video.autoplay = true
  video.playsInline = true
  video.setAttribute('muted', '')
  video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;pointer-events:none;'
  host.style.isolation = 'isolate' // keeps z-index:-1 above the host's own background, below its content
  host.insertBefore(video, host.firstChild)
  const play = video.play && video.play()
  if (play && play.catch) play.catch(() => {}) // a missing or unplayable file leaves the colour showing
  return video
}
