import { icon } from '../../components/common/Icons.js'
import { state } from '../../core/StateManager.js'
import { showToast } from '../../components/common/ToastManager.js'
import { audioPlayer } from '../../services/AudioPlayer.js'
import { fileUrlFromPath } from '../../core/videoBackground.js'
import { addAudioItem, removeItem, isAudioFileName, nameFromFile, formatDuration } from '../../core/mediaLibrary.js'

const el = (tag, className, text) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

/** Reads how long a file is by loading just its header. */
const durationOf = (src) =>
  new Promise((resolve) => {
    const a = new window.Audio()
    a.preload = 'metadata'
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 0)
    a.onerror = () => resolve(0)
    a.src = src
  })

/**
 * AudioBin — the walk-in music, bumpers and backing tracks the operator has added. Play one, pause it,
 * move through it, set the volume, loop it, or fade it out. Sound comes out of this computer.
 * File names are written with textContent, never innerHTML.
 */
export function createAudioBin() {
  const container = el('div', 'audio-bin')

  const header = el('div', 'audio-header')
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--border-color);background:var(--bg-active);gap:8px;'
  const title = el('h3', null, 'Audio')
  title.style.cssText = 'font-size:var(--font-size-sm);font-weight:600;margin:0;color:var(--text-primary);'
  const note = el('span', 'audio-note')
  note.style.cssText = 'flex:1;font-size:12px;color:var(--text-muted);'
  const add = el('button', 'btn')
  add.id = 'import-audio'
  add.append(icon('plus', 16), document.createTextNode(' Add audio'))
  const file = el('input')
  file.type = 'file'
  file.multiple = true
  file.accept = 'audio/*'
  file.hidden = true
  file.id = 'import-audio-file'
  header.append(title, note, add, file)

  // Now playing: position, volume, loop, fade out
  const player = el('div', 'audio-player')
  player.style.cssText = 'display:none;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid var(--border-color);flex-wrap:wrap;'
  const nowName = el('strong', 'audio-now text-ellipsis')
  nowName.style.cssText = 'min-width:120px;max-width:220px;font-size:13px;'
  const seek = el('input')
  seek.type = 'range'
  seek.id = 'audio-seek'
  seek.min = '0'
  seek.step = '1'
  seek.value = '0'
  seek.setAttribute('aria-label', 'Position')
  seek.style.cssText = 'flex:1;min-width:120px;'
  const time = el('span', 'audio-time')
  time.style.cssText = 'font-size:12px;color:var(--text-muted);min-width:80px;text-align:right;font-variant-numeric:tabular-nums;'
  const volLabel = el('label', null, 'Volume ')
  volLabel.style.cssText = 'font-size:12px;display:flex;align-items:center;gap:6px;'
  const vol = el('input')
  vol.type = 'range'
  vol.id = 'audio-volume'
  vol.min = '0'
  vol.max = '100'
  vol.value = '100'
  vol.setAttribute('aria-label', 'Volume')
  volLabel.appendChild(vol)
  const loopLabel = el('label', null)
  loopLabel.style.cssText = 'font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;'
  const loop = el('input')
  loop.type = 'checkbox'
  loop.id = 'audio-loop'
  loopLabel.append(loop, document.createTextNode(' Loop'))
  const fade = el('button', 'btn', 'Fade out')
  fade.id = 'audio-fade'
  fade.title = 'Fade the music out over 3 seconds'
  const stop = el('button', 'btn', 'Stop')
  stop.id = 'audio-stop'
  player.append(nowName, seek, time, volLabel, loopLabel, fade, stop)

  const list = el('div', 'audio-list')
  list.id = 'audio-list'
  list.style.cssText = 'padding:8px;overflow:auto;'
  container.append(header, player, list)

  const playing = () => state.get('audioPlayback') || {}

  const renderList = () => {
    const items = state.get('audioLibrary') || []
    const now = playing()
    list.textContent = ''
    if (!items.length) {
      const empty = el('div', 'audio-empty', 'No audio yet. Add the music you play before and after the service.')
      empty.style.cssText = 'color:var(--text-muted);font-size:13px;padding:16px 8px;'
      list.appendChild(empty)
      return
    }
    for (const item of items) {
      const isNow = now.id === item.id
      const row = el('div', `list-item audio-item${isNow ? ' active' : ''}`)
      row.dataset.id = item.id
      const play = el('button', 'btn btn--icon audio-play', isNow && now.playing ? '⏸' : '▶')
      play.setAttribute('aria-label', `${isNow && now.playing ? 'Pause' : 'Play'} ${item.name}`)
      play.style.cssText = 'min-width:28px;height:28px;padding:0;'
      const name = el('span', 'audio-label text-ellipsis', item.name)
      name.style.cssText = 'flex:1;min-width:0;'
      const dur = el('span', 'audio-duration text-muted', formatDuration(item.duration))
      dur.style.cssText = 'margin-left:auto;flex-shrink:0;font-variant-numeric:tabular-nums;'
      const remove = el('button', 'btn btn--icon audio-remove', '✕')
      remove.title = 'Remove from the library'
      remove.setAttribute('aria-label', `Remove ${item.name}`)
      remove.style.cssText = 'min-width:24px;height:24px;padding:0;font-size:12px;'
      row.append(play, name, dur, remove)
      list.appendChild(row)
    }
  }

  const renderPlayer = () => {
    const now = playing()
    const active = !!now.id
    player.style.display = active ? 'flex' : 'none'
    if (note.textContent !== (now.error || '') && now.error) note.textContent = now.error
    if (!active) return
    nowName.textContent = now.name
    seek.max = String(Math.max(1, Math.floor(now.duration || 0)))
    if (document.activeElement !== seek) seek.value = String(Math.floor(now.position || 0))
    time.textContent = `${formatDuration(now.position) || '0:00'} / ${formatDuration(now.duration) || '--:--'}`
    if (document.activeElement !== vol) vol.value = String(Math.round((now.volume ?? 1) * 100))
    loop.checked = !!now.loop
  }

  list.addEventListener('click', (e) => {
    const row = e.target.closest('.audio-item')
    if (!row) return
    const item = (state.get('audioLibrary') || []).find((a) => a.id === row.dataset.id)
    if (!item) return
    if (e.target.closest('.audio-remove')) {
      if (playing().id === item.id) audioPlayer.stop()
      state.set('audioLibrary', removeItem(state.get('audioLibrary'), item.id))
      return
    }
    audioPlayer.toggle(item)
  })
  list.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.audio-item')
    const item = row && (state.get('audioLibrary') || []).find((a) => a.id === row.dataset.id)
    if (item && !e.target.closest('button')) audioPlayer.play(item)
  })
  seek.addEventListener('input', () => audioPlayer.seek(Number(seek.value)))
  vol.addEventListener('input', () => audioPlayer.setVolume(Number(vol.value) / 100))
  loop.addEventListener('change', () => audioPlayer.setLoop(loop.checked))
  fade.addEventListener('click', () => audioPlayer.stop({ fadeMs: 3000 }))
  stop.addEventListener('click', () => audioPlayer.stop())

  add.addEventListener('click', () => file.click())
  file.addEventListener('change', async () => {
    const files = [...file.files]
    file.value = ''
    let items = state.get('audioLibrary') || []
    const problems = []
    for (const f of files) {
      if (!isAudioFileName(f.name)) {
        problems.push(`${f.name} is not an audio file I can play.`)
        continue
      }
      const location = window.electronAPI?.getPathForFile?.(f) || f.path
      if (!location) {
        problems.push('Audio needs the desktop app (the file stays where it is on this computer).')
        continue
      }
      const src = fileUrlFromPath(location)
      items = addAudioItem(items, { name: nameFromFile(f.name), src, duration: await durationOf(src) })
    }
    state.set('audioLibrary', items)
    note.textContent = problems.join(' ')
    if (problems.length) showToast(problems[0], 'error')
  })

  state.on('audioLibrary', renderList)
  state.on('audioPlayback', () => {
    renderPlayer()
    // The play/pause glyphs and the highlighted row follow what is playing
    const now = playing()
    const key = `${now.id}:${now.playing}`
    if (key !== container.dataset.listKey) {
      container.dataset.listKey = key
      renderList()
    }
  })
  renderList()
  renderPlayer()
  return container
}
