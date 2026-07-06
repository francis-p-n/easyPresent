import { Toolbar } from './features/controls/Toolbar.js'
import { LibraryPanel } from './features/library/LibraryPanel.js'
import { PlaylistPanel } from './features/library/PlaylistPanel.js'
import { SlideView } from './features/presentation/SlideView.js'
import { PreviewPanel } from './features/stage/PreviewPanel.js'
import { ShowControls } from './features/controls/ShowControls.js'
import { state } from './engine/StateManager.js'
import { storageManager } from './engine/StorageManager.js'
import { goLive, goLiveNext, goLivePrev } from './engine/navigation.js'
import { buildOutputPayload, payloadSignature } from './engine/outputSync.js'

/**
 * Main App Entry Point — Mounts core panels and lazy-loads optional modules
 */
class App {
  constructor() {
    this.init()
  }

  async init() {
    // Load persisted data before rendering (file-backed, so it's async)
    await storageManager.load()

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

    // Touch swipe gestures for iPad/mobile
    this._setupTouchGestures()

    // Handle view toggling (Lazy load panels if needed)
    state.on('activeView', (view) => this._updateView(view))

    // Handle edit mode (Lazy load editor)
    state.on('isEditing', (editing) => this._updateEditMode(editing))

    // Broadcast live slide updates (deduped — navigation fires both
    // 'liveSlideIndex' and 'layers', but the stage only needs one message)
    const broadcast = (slide) => {
      if (!window.electronAPI || !window.electronAPI.broadcastSlide) return
      // Send only what the stage display consumes (text with chord markup).
      // Slides can carry multi-MB base64 background data URLs — stringifying
      // and shipping those over IPC + Wi-Fi on every slide advance froze
      // navigation with imported PPTX decks.
      const payload = { text: (slide && slide.text) || '' }
      const sig = payload.text
      if (sig === this._lastBroadcast) return
      this._lastBroadcast = sig
      window.electronAPI.broadcastSlide(payload)
    }

    state.on('liveSlideIndex', (idx) => {
      const pres = state.get('selectedPresentation')
      broadcast(pres && pres.slides[idx] ? pres.slides[idx] : { text: '' })
    })

    state.on('layers', (layers) => {
      broadcast(layers.slide.active ? layers.slide.content || { text: '' } : { text: '' })
    })

    // Feed the audience output window. Deduped with a cheap signature so
    // multi-MB imported backgrounds aren't re-sent on every state event.
    const syncAudience = () => {
      if (!window.electronAPI || !window.electronAPI.updateAudienceOutput) return
      const themes = state.get('themes') || []
      const activeTheme = themes.find((t) => t.id === state.get('activeThemeId')) || themes[0]
      const payload = buildOutputPayload(
        state.get('layers'),
        activeTheme,
        state.get('showLogo'),
        state.get('timer_main')
      )
      const sig = payloadSignature(payload)
      if (sig === this._lastAudienceSig) return
      this._lastAudienceSig = sig
      window.electronAPI.updateAudienceOutput(payload)
    }
    state.on('layers', syncAudience)
    state.on('showLogo', syncAudience)
    state.on('activeThemeId', syncAudience)
    state.on('timer_main', syncAudience) // live {timer} token in messages

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

  }

  async _updateView(view) {
    const bottomView = document.getElementById('bottom-view')
    const resizer = document.getElementById('resizer-bottom')
    const mediaBin = document.getElementById('media-bin-container')
    const audioBin = document.getElementById('audio-bin-container')
    const slideView = document.getElementById('slide-view')

    // The center panel shows exactly ONE of: bible, slide editor, slide grid
    const slideEditor = document.getElementById('slide-editor-container')

    if (view === 'bible') {
      // Bible takes over the center — leave edit mode if it was open
      if (state.get('isEditing')) state.set('isEditing', false)
      slideView.style.display = 'none'
      if (slideEditor) slideEditor.style.display = 'none'

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

      if (state.get('isEditing')) {
        slideView.style.display = 'none'
        if (slideEditor) slideEditor.style.display = 'block'
      } else {
        slideView.style.display = 'block'
        if (slideEditor) slideEditor.style.display = 'none'
      }
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

      // Editor takes over the center — switch away from Bible if it was open
      if (state.get('activeView') === 'bible') state.set('activeView', 'library')
      const bibleContainer = document.getElementById('bible-panel-container')
      if (bibleContainer) bibleContainer.style.display = 'none'

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
      // Don't handle while the slide editor is open (it has its own key handling)
      if (state.get('isEditing')) return

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
          goLiveNext()
          break

        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          goLivePrev()
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
        goLive(parseInt(e.key, 10) - 1)
      }
    })
  }

  _setupTouchGestures() {
    let touchStartX = 0
    let touchStartY = 0

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
    }, { passive: true })

    document.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX
      const dy = e.changedTouches[0].clientY - touchStartY
      // Only treat as horizontal swipe if dx dominates and is large enough
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return

      if (dx < 0) goLiveNext()
      else goLivePrev()
    }, { passive: true })
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  new App()
})
