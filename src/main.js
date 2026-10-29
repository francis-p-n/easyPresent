import { Toolbar } from './features/controls/Toolbar.js'
import { LibraryPanel } from './features/library/LibraryPanel.js'
import { PlaylistPanel } from './features/library/PlaylistPanel.js'
import { ServicesHome } from './features/services/ServicesHome.js'
import { SlideView } from './features/presentation/SlideView.js'
import { PreviewPanel } from './features/stage/PreviewPanel.js'
import { ShowControls } from './features/controls/ShowControls.js'
import { state } from './core/StateManager.js'
import { storageManager } from './services/StorageManager.js'
import { goLiveNext, goLivePrev, goLiveSong, goLiveNumber } from './core/navigation.js'
import { buildOutputPayload, payloadSignature } from './core/outputSync.js'
import { getActiveSequence } from './core/arrangement.js'
import { initSongLibrary } from './songs/songLibrary.js'
import { installA11y } from './components/common/a11y.js'
import { showShortcutHelp } from './features/controls/ShortcutHelp.js'
import { buildLiveState } from './core/liveState.js'
import { buildLookup, eventToSpec, loadOverrides } from './core/shortcuts.js'
import { themeFor, livePresentation, presentationTransition } from './core/presentationDefaults.js'
import { applyPanelWidths, loadPanelWidths, readPanelWidths, savePanelWidths } from './core/workspaces.js'
import { registerUserFonts } from './services/fontStore.js'
import { syncRemoteButtons } from './features/controls/RemoteButtonsEditor.js'
import { makeTransposer } from './songs/transpose.js'
import { slideToChordProText } from './songs/chordpro.js'
import { buildStageChart } from './songs/stageChart.js'

/**
 * Every transient overlay that owns the keyboard while it's open. All of these
 * are `.remove()`d on close, so presence in the DOM means "currently open".
 */
export const MODAL_SELECTOR = [
  '.context-menu',
  '.modal-overlay', // WelcomeModal, SongImporter, ThemeEditor
  '#template-picker-overlay',
  '#confirm-dialog-overlay',
  '#rename-dialog-overlay',
  '#playlist-prompt-overlay',
  '#announcement-editor-overlay',
  '#arrangement-editor-overlay',
  '#shortcut-help-overlay', // it listens for the key to bind; the show shortcuts must not fire under it
  '#theme-editor-overlay'
].join(', ')

/**
 * Should this keydown be ignored by the global show shortcuts?
 *
 * The show shortcuts are bare keys (Escape/b/. blackout, arrows advance, 1-9
 * jump) because that's what presentation clickers emit. Bare keys are also what
 * everything else in the UI uses, so the guards matter more than the shortcuts:
 * an unguarded Escape blacks out the audience screen when the operator only
 * meant to dismiss a context menu.
 *
 * @param {KeyboardEvent} e
 * @param {boolean} isEditing  slide editor open — it owns the keyboard
 * @param {Document} doc       injectable for tests
 */
export function isShowShortcutBlocked(e, isEditing, doc = document) {
  const t = e.target
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return true
  if (isEditing) return true
  // An OS/app chord (Ctrl+B, Alt+Left, Ctrl+1 …) must not blank the projector
  // or jump the slide just because it shares a letter with a show shortcut.
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  // A modal/menu owns the keyboard while it's open.
  if (doc.querySelector(MODAL_SELECTOR)) return true
  return false
}

/** Dropdown menus (toolbar Screens/Library, playlist Add/Manage) that Escape should close before it clears the screen. */
const OPEN_MENU_SELECTOR = '#toolbar-screens-menu, #toolbar-library-menu, .playlist-menu'

/** Closes any open dropdown menu; returns true if there was one. */
export function closeOpenMenus(doc = document) {
  let closed = false
  const tabsMenu = doc.getElementById('control-tabs-menu')
  if (tabsMenu) {
    tabsMenu.remove() // Escape closes the control-tabs popover before it would clear the screen
    doc.getElementById('control-tabs-customize')?.setAttribute('aria-expanded', 'false')
    closed = true
  }
  doc.querySelectorAll(OPEN_MENU_SELECTOR).forEach((menu) => {
    if (menu.style.display === 'block') {
      menu.style.display = 'none'
      closed = true
    }
  })
  return closed
}

/** What each bindable shortcut does. The clear actions press the toolbar buttons so they behave exactly as a click would. */
const CLICK_ACTIONS = {
  clearAll: 'clear-btn-all',
  clearSlide: 'clear-btn-slide',
  clearMedia: 'clear-btn-media',
  clearProps: 'clear-btn-props',
  clearAudio: 'clear-btn-audio',
  logo: 'clear-btn-logo'
}

export function runShortcutAction(action) {
  if (CLICK_ACTIONS[action]) return document.getElementById(CLICK_ACTIONS[action])?.click()
  switch (action) {
    case 'next':
      return goLiveNext()
    case 'prev':
      return goLivePrev()
    case 'nextSong':
      return goLiveSong(1)
    case 'prevSong':
      return goLiveSong(-1)
    case 'hideAudienceText':
      return state.set('hideAudienceSlide', !state.get('hideAudienceSlide'))
    case 'help':
      return showShortcutHelp()
  }
}

/**
 * Runs the show shortcut for a keydown (a clicker's PageDown/PageUp/./b/Esc/F5 arrive as plain keys).
 * Returns false when the key was not for the show (typing, a dialog, a chord), so the caller stops too.
 */
export function handleShowKey(e, isEditing) {
  if (isShowShortcutBlocked(e, isEditing)) return false

  // Escape always closes an open dropdown first; only a bare Escape blanks the output
  if (e.key === 'Escape') {
    e.preventDefault()
    if (closeOpenMenus()) return true
  }

  const action = buildLookup(state.get('shortcutOverrides')).get(eventToSpec(e))
  // The Services page covers the slides: a clicker press there must not advance a show nobody can see.
  // Clearing the screen stays available.
  const servicesOpen = document.getElementById('services-home')?.hidden === false
  if (action && servicesOpen && !String(action).startsWith('clear')) return false
  if (action) {
    e.preventDefault()
    // A clicker button held down (or stuck) must not race through the slides or flicker the logo
    if (!e.repeat) runShortcutAction(action)
  }
  // A clicker's "start slideshow" key is F5: it must not reload the window or do anything else mid-service
  if (e.key === 'F5') e.preventDefault()
  return true
}

/** How long a typed slide number stays open for another digit ("1" then "2" = slide 12). */
const SLIDE_NUMBER_WINDOW_MS = 700

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
    state.set('shortcutOverrides', loadOverrides())
    syncRemoteButtons()
    registerUserFonts(state.get('userFonts')) // fonts the operator added draw in every panel
    state.on('userFonts', (fonts) => registerUserFonts(fonts))
    applyPanelWidths(loadPanelWidths()) // panel sizes survive a restart
    storageManager.reportRecovery()
    if (await initSongLibrary()) storageManager.scheduleSave()

    // Mount core components synchronously
    this.toolbar = new Toolbar(document.getElementById('toolbar'))
    this.library = new LibraryPanel(document.getElementById('library-panel'))
    this.playlist = new PlaylistPanel(document.getElementById('playlist-panel'))
    this.slideView = new SlideView(document.getElementById('slide-view'))
    this.preview = new PreviewPanel(document.getElementById('preview-panel'))
    this.showControls = new ShowControls(document.getElementById('show-controls'))

    // The home page: every service with its date, speaker and host. The app opens on it.
    const servicesEl = document.getElementById('services-home')
    if (servicesEl) {
      this.services = new ServicesHome(servicesEl)
      window.addEventListener('ep:toggle-services', () => this.services.toggle())
      this.services.open()
    }

    // Names for icon buttons, keyboard access to rows, and real dialog behaviour for every modal
    installA11y()

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
      // Chords ride along as ChordPro ([G]word) in the key the singer asked for, so
      // the band's Stage window can show them; the stage page strips them for lyrics-only use.
      const liveId = state.get('livePresentationId')
      const livePres = (state.get('presentations') || []).find((p) => p.id === liveId)
      const text = slide && livePres ? slideToChordProText(slide, makeTransposer(livePres)) : (slide && slide.text) || ''
      // The whole song and where we are in it: the band's chart scrolls with the slides.
      // Rebuilt only while a song slide is live; the signature below keeps repeats from re-sending.
      const chart = slide && livePres && state.get('layers').slide.active ? buildStageChart(livePres) : []
      const payload = { text, chart, index: chart.length ? state.get('liveSlideIndex') : -1 }
      const sig = JSON.stringify(payload)
      if (sig === this._lastBroadcast) return
      this._lastBroadcast = sig
      window.electronAPI.broadcastSlide(payload)
    }

    const broadcastLive = () => {
      const layers = state.get('layers')
      broadcast(layers.slide.active ? layers.slide.content || { text: '' } : { text: '' })
    }
    state.on('layers', broadcastLive)
    state.on('presentations', broadcastLive) // a key change while live must reach the band at once

    // Feed the audience output window. Deduped with a cheap signature so
    // multi-MB imported backgrounds aren't re-sent on every state event.
    const syncAudience = () => {
      if (!window.electronAPI || !window.electronAPI.updateAudienceOutput) return
      const themes = state.get('themes') || []
      const livePres = livePresentation(state.get('presentations'), state.get('livePresentationId'), state.get('selectedPresentation'))
      const activeTheme = themeFor(livePres, themes, state.get('activeThemeId'))
      const payload = buildOutputPayload(
        state.get('layers'),
        activeTheme,
        state.get('showLogo'),
        state.get('timer_main'),
        {
          hideSlide: state.get('hideAudienceSlide'),
          transition: state.get('outputTransition'),
          presentationTransition: presentationTransition(livePres),
          transitionMs: state.get('outputTransitionMs'),
          userFonts: state.get('userFonts'),
          look: state.get('activePlaylist')?.meta?.look
        }
      )
      const sig = payloadSignature(payload)
      if (sig === this._lastAudienceSig) return
      this._lastAudienceSig = sig
      window.electronAPI.updateAudienceOutput(payload)
    }
    state.on('layers', syncAudience)
    state.on('showLogo', syncAudience)
    state.on('hideAudienceSlide', syncAudience)
    state.on('outputTransition', syncAudience)
    state.on('outputTransitionMs', syncAudience)
    state.on('activeThemeId', syncAudience)
    state.on('themes', syncAudience)
    state.on('presentations', syncAudience) // a presentation's own theme/transition can change while it is live
    state.on('livePresentationId', syncAudience)
    state.on('activePlaylist', syncAudience) // a service's own background and text style
    state.on('playlists', syncAudience)
    state.on('timer_main', syncAudience) // live {timer} token in messages

    // Phone remote (web page served by the stage server): the same actions as the keyboard shortcuts
    if (window.electronAPI && window.electronAPI.onRemoteCommand) {
      // The remote's 'clear' is the show's "Clear everything"; every other command is an action id
      window.electronAPI.onRemoteCommand((cmd) => runShortcutAction(cmd === 'clear' ? 'clearAll' : cmd))
    }

    // Feed the presenter / PA views (current + next slide, clock, message).
    // Text-only, so a cheap JSON signature is enough to dedupe.
    const syncLiveState = () => {
      if (!window.electronAPI || !window.electronAPI.broadcastLiveState) return
      // The live song, not the selected one: selecting another song must not change what Presenter/PA report
      const liveId = state.get('livePresentationId')
      const live = buildLiveState({
        presentation: (state.get('presentations') || []).find((p) => p.id === liveId) || state.get('selectedPresentation'),
        liveIndex: state.get('liveSlideIndex'),
        layers: state.get('layers'),
        showLogo: state.get('showLogo'),
        timerValue: state.get('timer_main')
      })
      const sig = JSON.stringify(live)
      if (sig === this._lastLiveSig) return
      this._lastLiveSig = sig
      window.electronAPI.broadcastLiveState(live)
    }
    for (const key of ['layers', 'liveSlideIndex', 'livePresentationId', 'showLogo', 'timer_main', 'presentations', 'selectedPresentation']) {
      state.on(key, syncLiveState)
    }
    syncLiveState()

    // Auto save data
    storageManager.initAutoSave()

    // Show welcome modal on first launch
    if (!localStorage.getItem('hasSeenWelcome')) {
      import('./components/common/WelcomeModal.js').then(({ WelcomeModal }) => {
        // Remembered as soon as it is shown: closing the app mid-tour must not bring it back every launch
        localStorage.setItem('hasSeenWelcome', 'true')
        new WelcomeModal(() => {})
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
    const appRoot = document.getElementById('app')
    const centerPanel = document.getElementById('panel-center')
    const slideView = document.getElementById('slide-view')
    let slideEditor = document.getElementById('slide-editor-container')

    // Edit is a distinct app mode, not an inline center-panel takeover — the
    // class flip drives the layout (library/playlist/preview/clear buttons
    // all hide via layout.css) so nothing in the presenter view is reachable
    // while the operator is editing a slide.
    appRoot?.classList.toggle('app-layout--editing', editing)

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
      if (pres && getActiveSequence(pres)[idx]) {
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
      savePanelWidths(readPanelWidths())
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
      if (!handleShowKey(e, state.get('isEditing'))) return

      // Number keys jump to a slide; digits typed in quick succession form one
      // number, so songs with 10+ slides are reachable ("1","2" -> slide 12)
      if (e.key.length === 1 && e.key >= '0' && e.key <= '9') {
        clearTimeout(this._slideNumberTimer)
        let typed = (this._slideNumber || '') + e.key
        if (!goLiveNumber(parseInt(typed, 10))) {
          // no such slide: treat this digit as the start of a new number
          typed = e.key
          if (!goLiveNumber(parseInt(typed, 10))) typed = ''
        }
        this._slideNumber = typed
        this._slideNumberTimer = setTimeout(() => (this._slideNumber = ''), SLIDE_NUMBER_WINDOW_MS)
      }
    })
  }

  _setupTouchGestures() {
    let touchStartX = 0
    let touchStartY = 0
    let swipeAllowed = false

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX
      touchStartY = e.touches[0].clientY
      // Only a swipe that begins on the slide area counts: sliding along the library or
      // playlist, a dropdown, a text box or a dialog must never advance the live slide
      const t = e.target
      swipeAllowed =
        !!t.closest?.('.panel-center') && !t.closest('input, select, textarea, .modal-overlay, .context-menu')
    }, { passive: true })

    document.addEventListener('touchend', (e) => {
      if (!swipeAllowed) return
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
