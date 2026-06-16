import { Toolbar } from './features/controls/Toolbar.js'
import { LibraryPanel } from './features/library/LibraryPanel.js'
import { PlaylistPanel } from './features/library/PlaylistPanel.js'
import { SlideView } from './features/presentation/SlideView.js'
import { PreviewPanel } from './features/stage/PreviewPanel.js'
import { ShowControls } from './features/controls/ShowControls.js'
import { state } from './engine/StateManager.js'
import { storageManager } from './engine/StorageManager.js'

/**
 * Main App Entry Point — Mounts core panels and lazy-loads optional modules
 */
class App {
  constructor() {
    this.init()
  }

  init() {
    // Load persisted data before rendering
    storageManager.load()

    // Mount core components synchronously
    this.toolbar = new Toolbar(document.getElementById('toolbar'))
    this.library = new LibraryPanel(document.getElementById('library-panel'))
    this.playlist = new PlaylistPanel(document.getElementById('playlist-panel'))
    this.slideView = new SlideView(document.getElementById('slide-view'))
    this.preview = new PreviewPanel(document.getElementById('preview-panel'))
    this.showControls = new ShowControls(document.getElementById('show-controls'))

    // Setup panel resizers
    this._setupResizer('resizer-left', 'panel-left', 'left')
    this._setupResizer('resizer-right', 'panel-right', 'right')

    // Keyboard shortcuts
    this._setupKeyboardShortcuts()

    // Handle view toggling (Lazy load panels if needed)
    state.on('activeView', (view) => this._updateView(view))

    // Handle edit mode (Lazy load editor)
    state.on('isEditing', (editing) => this._updateEditMode(editing))

    // Broadcast live slide updates
    state.on('liveSlideIndex', (idx) => {
      if (window.electronAPI && window.electronAPI.broadcastSlide) {
        const pres = state.get('selectedPresentation')
        if (pres && pres.slides[idx]) {
          window.electronAPI.broadcastSlide(pres.slides[idx])
        } else {
          window.electronAPI.broadcastSlide({ text: '' })
        }
      }
    })

    state.on('layers', (layers) => {
      if (window.electronAPI && window.electronAPI.broadcastSlide) {
        if (!layers.slide.active) {
          window.electronAPI.broadcastSlide({ text: '' })
        } else {
          window.electronAPI.broadcastSlide(layers.slide.content || { text: '' })
        }
      }
    })

    // Auto save data
    storageManager.initAutoSave()

    // Show welcome modal on first launch
    if (!localStorage.getItem('hasSeenWelcome')) {
      import('./components/common/WelcomeModal.js').then(({ WelcomeModal }) => {
        new WelcomeModal(() => {
          localStorage.setItem('hasSeenWelcome', 'true')
        })
      })
    }

    console.log('EasyPresent initialized')
  }

  async _updateView(view) {
    const bottomView = document.getElementById('bottom-view')
    const resizer = document.getElementById('resizer-bottom')
    const mediaBin = document.getElementById('media-bin-container')
    const audioBin = document.getElementById('audio-bin-container')
    const slideView = document.getElementById('slide-view')

    // Handle slide view vs bible view
    if (view === 'bible') {
      slideView.style.display = 'none'

      let bibleContainer = document.getElementById('bible-panel-container')
      if (!bibleContainer) {
        bibleContainer = document.createElement('div')
        bibleContainer.id = 'bible-panel-container'
        bibleContainer.style.height = '100%'
        document.getElementById('panel-center').appendChild(bibleContainer)

        // Lazy-load Bible Panel
        const { createBiblePanel } = await import('./features/bible/BiblePanel.js')
        createBiblePanel(bibleContainer)
      }
      bibleContainer.style.display = 'flex'
    } else {
      const bibleContainer = document.getElementById('bible-panel-container')
      if (bibleContainer) bibleContainer.style.display = 'none'

      slideView.style.display = state.get('isEditing') ? 'none' : 'block'
    }

    if (view === 'media' || view === 'audio') {
      bottomView.style.display = 'flex'
      resizer.style.display = 'block'

      if (view === 'media' && !this.mediaBinLoaded) {
        const { createMediaBin } = await import('./features/media/MediaBin.js')
        mediaBin.appendChild(createMediaBin())
        this.mediaBinLoaded = true
      }
      if (view === 'audio' && !this.audioBinLoaded) {
        const { createAudioBin } = await import('./features/media/AudioBin.js')
        audioBin.appendChild(createAudioBin())
        this.audioBinLoaded = true
      }

      mediaBin.style.display = view === 'media' ? 'block' : 'none'
      audioBin.style.display = view === 'audio' ? 'block' : 'none'
    } else {
      bottomView.style.display = 'none'
      resizer.style.display = 'none'
    }
  }

  async _updateEditMode(editing) {
    const centerPanel = document.getElementById('panel-center')
    const slideView = document.getElementById('slide-view')
    let slideEditor = document.getElementById('slide-editor-container')

    if (editing) {
      if (!slideEditor) {
        slideEditor = document.createElement('div')
        slideEditor.id = 'slide-editor-container'
        slideEditor.style.width = '100%'
        slideEditor.style.height = '100%'
        centerPanel.appendChild(slideEditor)

        // Lazy-load Slide Editor
        const { createSlideEditor } = await import('./features/presentation/SlideEditor.js')
        this.slideEditorInstance = createSlideEditor(slideEditor)
      }

      slideView.style.display = 'none'
      slideEditor.style.display = 'block'

      // Update editor data for current slide
      const pres = state.get('selectedPresentation')
      const idx = state.get('activeSlideIndex')
      if (pres && pres.slides[idx]) {
        state.set('activeSlideIndex', idx) // Trigger editor update
      }

      if (this.slideEditorInstance) {
        this.slideEditorInstance.resize()
      }
    } else {
      slideView.style.display = 'block'
      if (slideEditor) slideEditor.style.display = 'none'
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
        case 'PageDown':
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
        case 'PageUp':
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

        case 'b':
        case 'B':
        case '.':
          // Standard clicker 'Black screen' toggle
          if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault()
            document.getElementById('clear-btn-all')?.click()
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
