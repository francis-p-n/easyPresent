import { Toolbar } from './components/Toolbar.js'
import { LibraryPanel } from './components/LibraryPanel.js'
import { PlaylistPanel } from './components/PlaylistPanel.js'
import { SlideView } from './components/SlideView.js'
import { PreviewPanel } from './components/PreviewPanel.js'
import { ShowControls } from './components/ShowControls.js'
import { createMediaBin } from './components/MediaBin.js'
import { createAudioBin } from './components/AudioBin.js'
import { createImportExport } from './components/ImportExport.js'
import { state } from './engine/StateManager.js'

/**
 * Main App Entry Point — Mounts all panels and sets up keyboard shortcuts
 */
class App {
  constructor() {
    this.init()
  }

  init() {
    // Mount components
    this.toolbar = new Toolbar(document.getElementById('toolbar'))
    this.library = new LibraryPanel(document.getElementById('library-panel'))
    this.playlist = new PlaylistPanel(document.getElementById('playlist-panel'))
    this.slideView = new SlideView(document.getElementById('slide-view'))
    this.preview = new PreviewPanel(document.getElementById('preview-panel'))
    this.showControls = new ShowControls(document.getElementById('show-controls'))
    
    // Phase 3 components
    document.getElementById('media-bin-container').appendChild(createMediaBin())
    document.getElementById('audio-bin-container').appendChild(createAudioBin())
    // For now, ImportExport can be part of Library
    // document.getElementById('library-panel').appendChild(createImportExport())

    // Setup panel resizers
    this._setupResizer('resizer-left', 'panel-left', 'left')
    this._setupResizer('resizer-right', 'panel-right', 'right')

    // Keyboard shortcuts
    this._setupKeyboardShortcuts()
    
    // Handle view toggling
    state.on('activeView', (view) => this._updateView(view))

    console.log('EasyPresent initialized')
  }

  _updateView(view) {
    const bottomView = document.getElementById('bottom-view')
    const resizer = document.getElementById('resizer-bottom')
    const mediaBin = document.getElementById('media-bin-container')
    const audioBin = document.getElementById('audio-bin-container')

    if (view === 'media' || view === 'audio') {
      bottomView.style.display = 'flex'
      resizer.style.display = 'block'
      mediaBin.style.display = view === 'media' ? 'block' : 'none'
      audioBin.style.display = view === 'audio' ? 'block' : 'none'
    } else {
      bottomView.style.display = 'none'
      resizer.style.display = 'none'
    }
  }

  _setupResizer(resizerId, panelId, side) {
    const resizer = document.getElementById(resizerId)
    const panel = document.getElementById(panelId)
    if (!resizer || !panel) return

    let startX, startWidth

    const onMouseMove = (e) => {
      const dx = e.clientX - startX
      if (side === 'left') {
        panel.style.width = `${startWidth + dx}px`
      } else {
        panel.style.width = `${startWidth - dx}px`
      }
    }

    const onMouseUp = () => {
      resizer.classList.remove('active')
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    resizer.addEventListener('mousedown', (e) => {
      startX = e.clientX
      startWidth = panel.offsetWidth
      resizer.classList.add('active')
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    })
  }

  _setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't handle if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      const pres = state.get('selectedPresentation')

      switch (e.key) {
        case 'F1':
          e.preventDefault()
          document.getElementById('clear-btn-all')?.click()
          break
        case 'F2':
          e.preventDefault()
          document.getElementById('clear-btn-slide')?.click()
          break
        case 'F3':
          e.preventDefault()
          document.getElementById('clear-btn-media')?.click()
          break
        case 'F4':
          e.preventDefault()
          document.getElementById('clear-btn-props')?.click()
          break
        case 'F5':
          e.preventDefault()
          document.getElementById('clear-btn-audio')?.click()
          break
        case 'F6':
          e.preventDefault()
          document.getElementById('clear-btn-logo')?.click()
          break

        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault()
          if (pres) {
            const current = state.get('liveSlideIndex')
            const next = Math.min(current + 1, pres.slides.length - 1)
            state.set('liveSlideIndex', next)
            state.set('activeSlideIndex', next)
            const layers = { ...state.get('layers') }
            layers.slide = { active: true, content: pres.slides[next] }
            state.set('layers', layers)
          }
          break

        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          if (pres) {
            const current = state.get('liveSlideIndex')
            const prev = Math.max(current - 1, 0)
            state.set('liveSlideIndex', prev)
            state.set('activeSlideIndex', prev)
            const layers = { ...state.get('layers') }
            layers.slide = { active: true, content: pres.slides[prev] }
            state.set('layers', layers)
          }
          break

        case 'Escape':
          e.preventDefault()
          document.getElementById('clear-btn-all')?.click()
          break
      }

      // Number keys 1-9 to jump to slide
      if (e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key, 10) - 1
        if (pres && idx < pres.slides.length) {
          state.set('liveSlideIndex', idx)
          state.set('activeSlideIndex', idx)
          const layers = { ...state.get('layers') }
          layers.slide = { active: true, content: pres.slides[idx] }
          state.set('layers', layers)
        }
      }
    })
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new App()
})
