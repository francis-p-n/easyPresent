import { icon } from '../../components/common/Icons.js'

export function createAudioBin() {
  const container = document.createElement('div')
  container.className = 'audio-bin'
  container.innerHTML = `
        <div class="audio-header" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; border-bottom: 1px solid var(--border-color); background: var(--bg-active);">
            <h3 style="font-size: var(--font-size-sm); font-weight: 600; margin: 0; color: var(--text-primary);">Audio Playlist</h3>
            <div class="audio-controls">
                <button id="import-audio" class="btn btn--icon">
                    ${icon('plus', 16).outerHTML}
                </button>
            </div>
        </div>
        <div class="audio-list" id="audio-list" style="padding: 8px;"></div>
    `

  setTimeout(() => {
    const list = container.querySelector('#audio-list')
    import('../../engine/MediaManager.js').then((module) => {
      const MediaManager = module.default
      import('../../engine/StateManager.js').then((stateModule) => {
        const state = stateModule.state

        state.on('audio:loaded', (items) => {
          list.innerHTML = items
            .map(
              (item) => `
                        <div class="list-item audio-item" data-id="${item.id}">
                            <div class="list-item__icon">${icon('audio', 16).outerHTML}</div>
                            <span class="audio-label text-ellipsis" style="flex: 1; min-width: 0;">${item.name}</span>
                            <span class="audio-duration text-muted" style="margin-left: auto; flex-shrink: 0;">${formatTime(item.duration)}</span>
                        </div>
                    `
            )
            .join('')
        })

        MediaManager.loadAudioLibrary()
      })
    })
  }, 0)

  return container
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
