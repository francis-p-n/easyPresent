import { icon } from '../../components/common/Icons.js'
import { state } from '../../core/StateManager.js'
import { showToast } from '../../components/common/ToastManager.js'
import { rasterizeIfSvg } from '../../services/svgRaster.js'
import { fileUrlFromPath } from '../../core/videoBackground.js'
import { addMediaItem, removeItem, isImageFileName, isVideoFileName, nameFromFile, MAX_IMAGE_BYTES } from '../../core/mediaLibrary.js'

const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`))
    reader.readAsDataURL(file)
  })

/** What is on the media layer right now, by library id (or null). */
const liveMediaId = () => {
  const layer = state.get('layers')?.media
  return layer && layer.active && layer.content ? layer.content.id : null
}

/** Puts a picture or video on the audience screen behind the slide text; the same item again takes it off. */
export function toggleMedia(item) {
  const layers = { ...state.get('layers') }
  const live = liveMediaId() === item.id
  layers.media = live ? { active: false, content: null } : { active: true, content: { id: item.id, type: item.type, src: item.src, name: item.name } }
  state.set('layers', layers)
}

/**
 * MediaBin — the pictures and videos the operator has added. Click one to put it on the screen
 * (behind the slide text); click it again, or use Clear Media, to take it off. Everything the
 * operator typed or a file is called is written with textContent, never innerHTML.
 */
export function createMediaBin() {
  const container = el('div', 'media-bin')

  const header = el('div', 'media-header')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border-color);background:var(--bg-active);gap:8px;'
  const title = el('h3', null, 'Media')
  title.style.cssText = 'font-size:var(--font-size-sm);font-weight:600;margin:0;color:var(--text-primary);'
  const note = el('span', 'media-note')
  note.style.cssText = 'flex:1;font-size:12px;color:var(--text-muted);'
  const add = el('button', 'btn')
  add.id = 'import-media'
  add.append(icon('plus', 16), document.createTextNode(' Add pictures or videos'))
  const file = el('input')
  file.type = 'file'
  file.multiple = true
  file.accept = 'image/*,video/*'
  file.hidden = true
  file.id = 'import-media-file'
  header.append(title, note, add, file)

  const grid = el('div', 'media-grid')
  grid.id = 'media-grid'
  grid.style.cssText = 'padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;overflow:auto;'
  container.append(header, grid)

  const render = () => {
    const items = state.get('mediaLibrary') || []
    const live = liveMediaId()
    grid.textContent = ''
    if (!items.length) {
      const empty = el('div', 'media-empty', 'No pictures or videos yet. Add some to put behind the lyrics or show on their own.')
      empty.style.cssText = 'grid-column:1/-1;color:var(--text-muted);font-size:13px;padding:16px 8px;'
      grid.appendChild(empty)
      return
    }
    for (const item of items) {
      const card = el('div', `media-item${item.id === live ? ' media-item--live' : ''}`)
      card.dataset.id = item.id
      card.tabIndex = 0
      card.setAttribute('role', 'button')
      card.setAttribute('aria-pressed', item.id === live ? 'true' : 'false')
      card.setAttribute('aria-label', `${item.id === live ? 'Take off screen' : 'Show on screen'}: ${item.name}`)
      card.style.cssText = `position:relative;border:2px solid ${item.id === live ? 'var(--accent-red)' : 'var(--border-color)'};border-radius:8px;overflow:hidden;cursor:pointer;background:#000;`
      const thumb = el('div', 'media-thumb')
      thumb.style.cssText = 'aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:#000;'
      if (item.type === 'image') {
        const img = el('img')
        img.src = item.src
        img.alt = ''
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;'
        thumb.appendChild(img)
      } else {
        const video = el('video')
        video.src = item.src
        video.muted = true
        video.preload = 'metadata'
        video.style.cssText = 'width:100%;height:100%;object-fit:cover;pointer-events:none;'
        thumb.appendChild(video)
        const badge = el('span', 'media-kind', 'VIDEO')
        badge.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(0,0,0,.7);color:#fff;font-size:11px;padding:1px 6px;border-radius:4px;'
        card.appendChild(badge)
      }
      const label = el('div', 'media-label text-ellipsis', item.name)
      label.style.cssText = 'padding:4px 8px;font-size:12px;background:var(--bg-panel);color:var(--text-primary);'
      const remove = el('button', 'btn btn--icon media-remove', '✕')
      remove.title = 'Remove from the library'
      remove.setAttribute('aria-label', `Remove ${item.name}`)
      remove.style.cssText = 'position:absolute;top:2px;right:2px;min-width:24px;height:24px;padding:0;font-size:12px;'
      card.append(thumb, label, remove)
      if (item.id === live) {
        const tag = el('span', 'media-live', 'ON SCREEN')
        tag.style.cssText = 'position:absolute;bottom:26px;left:4px;background:var(--accent-red-strong);color:#fff;font-size:11px;font-weight:700;padding:1px 6px;border-radius:4px;'
        card.appendChild(tag)
      }
      grid.appendChild(card)
    }
  }

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.media-item')
    if (!card) return
    const item = (state.get('mediaLibrary') || []).find((m) => m.id === card.dataset.id)
    if (!item) return
    if (e.target.closest('.media-remove')) {
      if (liveMediaId() === item.id) toggleMedia(item)
      state.set('mediaLibrary', removeItem(state.get('mediaLibrary'), item.id))
      return
    }
    toggleMedia(item)
  })
  grid.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('media-item')) {
      e.preventDefault()
      e.target.click()
    }
  })

  add.addEventListener('click', () => file.click())
  file.addEventListener('change', async () => {
    const files = [...file.files]
    file.value = ''
    let list = state.get('mediaLibrary') || []
    const problems = []
    for (const f of files) {
      try {
        if (isImageFileName(f.name)) {
          if (f.size > MAX_IMAGE_BYTES) throw new Error(`${f.name} is over 20 MB.`)
          const src = await rasterizeIfSvg(await readAsDataUrl(f))
          list = addMediaItem(list, { name: nameFromFile(f.name), type: 'image', src })
        } else if (isVideoFileName(f.name)) {
          const location = window.electronAPI?.getPathForFile?.(f) || f.path
          if (!location) throw new Error('Videos need the desktop app (they stay where they are on this computer).')
          list = addMediaItem(list, { name: nameFromFile(f.name), type: 'video', src: fileUrlFromPath(location) })
        } else {
          throw new Error(`${f.name} is not a picture or video I can use.`)
        }
      } catch (err) {
        problems.push(err.message)
      }
    }
    state.set('mediaLibrary', list)
    note.textContent = problems.join(' ')
    if (problems.length) showToast(problems[0], 'error')
  })

  state.on('mediaLibrary', render)
  state.on('layers', render)
  render()
  return container
}
