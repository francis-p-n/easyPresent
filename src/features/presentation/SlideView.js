import { state } from '../../engine/StateManager.js'
import { icon } from '../../components/common/Icons.js'
import NativeRender from '../../engine/NativeRender.js'
import { renderChordSheet } from './ChordSheet.js'
import { announcementEditor } from './AnnouncementEditor.js'
import { goLive } from '../../engine/navigation.js'
import { getActiveSequence } from '../../engine/arrangement.js'
import { hasLayout, renderSlideLayout } from '../../engine/slideLayout.js'

/**
 * SlideView — Center panel showing slide thumbnails in a grid
 */
export class SlideView {
  constructor(container) {
    this.container = container
    this.render()
    this._bindEvents()

    state.on('selectedPresentation', () => this.render())
    state.on('liveSlideIndex', () => this._updateLiveState())
    state.on('activeSlideIndex', () => this._updateActiveState())
    // Thumbnails bake the active theme's styles (font, color, size) into the
    // rendered image — without this, changing a theme (e.g. its font) only
    // ever showed up once something else happened to trigger a re-render
    state.on('activeThemeId', () => this._renderSlides())
    state.on('themes', () => this._renderSlides())
  }

  render() {
    this.container.innerHTML = ''

    const pres = state.get('selectedPresentation')

    // Header
    const header = document.createElement('div')
    header.className = 'panel-header slide-view-header'
    header.innerHTML = `
      <span class="panel-header__title">${pres ? pres.name : 'No Presentation Selected'}</span>
      <div class="panel-header__actions" style="display:flex; align-items:center; gap:10px;">
        ${
          pres && pres.linkedAudio
            ? `
          <button class="btn btn--icon" id="play-rehearsal-audio" title="Play Rehearsal Audio" style="color: var(--primary-color);">
            ${icon('play', 14).outerHTML}
          </button>
          <audio id="rehearsal-audio-player" src="${pres.linkedAudio}" style="display:none;"></audio>
        `
            : ''
        }
        ${
          pres &&
          pres.slides.some(
            (s) => s.linesData && s.linesData.some((l) => l.chords && l.chords.length > 0)
          )
            ? `
          <label style="font-size:12px; display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="checkbox" id="toggle-chords-checkbox" /> Show Chords
          </label>
        `
            : ''
        }
        ${
          pres && pres.slides.length > 0
            ? `
          <button class="btn btn--icon tooltip" id="arrangement-btn" data-tooltip="Arrangement">
            ${icon('layers', 14).outerHTML}
          </button>
        `
            : ''
        }
        ${pres ? `<span class="text-muted text-xs">${getActiveSequence(pres).length} slides</span>` : ''}
      </div>
    `
    this.container.appendChild(header)

    // Slide grid
    const grid = document.createElement('div')
    grid.className = 'slide-grid'
    grid.id = 'slide-grid'
    this.container.appendChild(grid)

    // Chord sheet container
    const chordSheet = document.createElement('div')
    chordSheet.className = 'chord-sheet'
    chordSheet.id = 'chord-sheet'
    chordSheet.style.display = 'none'
    chordSheet.style.padding = '20px'
    chordSheet.style.overflowY = 'auto'
    chordSheet.style.height = 'calc(100% - 40px)'
    chordSheet.style.fontFamily = 'monospace'
    chordSheet.style.fontSize = '18px'
    chordSheet.style.backgroundColor = 'var(--bg-panel)'
    this.container.appendChild(chordSheet)

    // Checkbox event
    const checkbox = header.querySelector('#toggle-chords-checkbox')
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          grid.style.display = 'none'
          chordSheet.style.display = 'block'
          this._renderChordSheet()
        } else {
          grid.style.display = 'grid'
          chordSheet.style.display = 'none'
        }
      })
    }

    // Arrangement editor
    header.querySelector('#arrangement-btn')?.addEventListener('click', async () => {
      if (!pres) return
      const { arrangementEditor } = await import('./ArrangementEditor.js')
      arrangementEditor.open(pres.id)
    })

    // Audio Playback Event
    const playBtn = header.querySelector('#play-rehearsal-audio')
    const audioPlayer = header.querySelector('#rehearsal-audio-player')
    if (playBtn && audioPlayer) {
      playBtn.addEventListener('click', () => {
        if (audioPlayer.paused) {
          audioPlayer.play()
          playBtn.innerHTML = icon('pause', 14).outerHTML
        } else {
          audioPlayer.pause()
          playBtn.innerHTML = icon('play', 14).outerHTML
        }
      })
      audioPlayer.addEventListener('ended', () => {
        playBtn.innerHTML = icon('play', 14).outerHTML
      })
    }

    this._renderSlides()
  }

  _renderChordSheet() {
    const chordSheet = this.container.querySelector('#chord-sheet')
    if (!chordSheet) return
    renderChordSheet(chordSheet)
  }

  _renderSlides() {
    const grid = this.container.querySelector('#slide-grid')
    if (!grid) return
    grid.innerHTML = ''

    const pres = state.get('selectedPresentation')
    if (!pres) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          ${icon('tv', 48).outerHTML}
          <div class="empty-state__text" style="margin-bottom: var(--spacing-sm);">Select a presentation from the library<br>or playlist to view slides</div>
          <button class="btn btn--primary" id="slideview-create-btn">
            <span style="display:flex; align-items:center; justify-content:center;">${icon('plus', 14).outerHTML}</span>
            Create Presentation
          </button>
        </div>
      `
      return
    }

    const liveIdx = state.get('liveSlideIndex')
    const activeIdx = state.get('activeSlideIndex')
    // The live slide belongs to whatever presentation was live when broadcast.
    // When the operator navigates to a DIFFERENT presentation in the library,
    // `liveSlideIndex` still holds the position from the last one — without
    // this identity check, we'd slap the "LIVE" badge on whatever slide
    // happens to sit at that position in the newly-viewed presentation.
    const liveContentId = state.get('layers')?.slide?.content?.id
    const fragment = document.createDocumentFragment()

    // Renders the active arrangement's sequence, not necessarily pres.slides —
    // a custom arrangement can reference the same slide more than once (e.g.
    // a repeated chorus), so `index` here is a position in that sequence,
    // matching what goLive()/goLiveNext() navigate over.
    let lastSection = null
    getActiveSequence(pres).forEach((slide, index) => {
      // Insert a section header when the PPTX section changes between slides
      if (slide.section && slide.section !== lastSection) {
        const sectionHeader = document.createElement('div')
        sectionHeader.className = 'slide-grid__section'
        sectionHeader.textContent = slide.section
        fragment.appendChild(sectionHeader)
        lastSection = slide.section
      }

      const thumb = document.createElement('div')
      thumb.className = 'slide-thumbnail'
      thumb.dataset.index = index
      thumb.id = `slide-thumb-${index}`

      const isLive = index === liveIdx && liveContentId && slide.id === liveContentId
      if (isLive) thumb.classList.add('live')
      else if (index === activeIdx) thumb.classList.add('active')

      // Group label
      if (slide.label) {
        const label = document.createElement('div')
        label.className = `slide-thumbnail__label slide-thumbnail__label--${slide.group || 'intro'}`
        label.textContent = slide.label
        thumb.appendChild(label)
      }

      // Content preview (high-fidelity canvas render thumbnail)
      const content = document.createElement('div')
      content.className = 'slide-thumbnail__content'

      const activeThemeId = state.get('activeThemeId')
      const themes = state.get('themes') || []
      const activeTheme = themes.find((t) => t.id === activeThemeId) || themes[0]

      const styleOpts = {
        fontSize: 48,
        bold: true,
        strokeWidth: 4,
        strokeColor: '#000000',
        hasShadow: true,
        shadowOffsetX: 3,
        shadowOffsetY: 3,
        color: '#FFFFFF'
      }

      if (activeTheme && activeTheme.styles) {
        Object.assign(styleOpts, activeTheme.styles)
        if (activeTheme.styles.textAlign) {
          styleOpts.hAlign = activeTheme.styles.textAlign
        }
      }

      // Formatting captured from the slide's own source (e.g. PPTX import)
      // takes precedence over the generic theme defaults above
      if (slide.style) Object.assign(styleOpts, slide.style)

      // Slides with an image background (e.g. imported PPTX designs) get a
      // transparent text layer composited over the image via layered CSS
      const bgMedia =
        slide.background && slide.background.type === 'media' && slide.background.mediaPath

      // Prefer the slide's own background color (e.g. from a PPTX import) so
      // solid-color slides don't all fall back to black
      const slideBgColor =
        slide.background && slide.background.type === 'color' && slide.background.color
          ? slide.background.color
          : null

      if (hasLayout(slide)) {
        // Imported layout slide: render positioned text boxes + images faithful
        // to the original, instead of collapsing everything into one text block.
        content.style.backgroundColor = slideBgColor || '#000000'
        if (bgMedia) {
          content.style.backgroundImage = `url(${slide.background.mediaPath})`
          content.style.backgroundSize = 'cover'
          content.style.backgroundPosition = 'center'
          content.style.backgroundRepeat = 'no-repeat'
        }
        renderSlideLayout(content, slide)
      } else {
        if (bgMedia) styleOpts.transparentBg = true

        // Generate a high-fidelity scaled data URL of the slide text
        const imgUrl = NativeRender.generateThumbnailDataUrl(slide.text || '', styleOpts)

        if (bgMedia) {
          content.style.backgroundImage = `url(${imgUrl}), url(${slide.background.mediaPath})`
          content.style.backgroundSize = 'contain, cover'
        } else {
          content.style.backgroundImage = `url(${imgUrl})`
          content.style.backgroundSize = 'contain'
        }
        content.style.backgroundPosition = 'center'
        content.style.backgroundRepeat = 'no-repeat'
        content.style.backgroundColor =
          slideBgColor || styleOpts.backgroundColor || '#000000'
      }

      thumb.appendChild(content)

      // Slide number
      const num = document.createElement('div')
      num.className = 'slide-thumbnail__number'
      num.textContent = index + 1
      thumb.appendChild(num)

      // Quick-edit badge for announcement slides
      if (slide.type === 'announcement') {
        const editBadge = document.createElement('div')
        editBadge.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(59,130,246,0.85);color:white;font-size:9px;padding:2px 5px;border-radius:3px;pointer-events:none;font-weight:600;letter-spacing:0.3px;'
        editBadge.textContent = 'DBL-EDIT'
        thumb.appendChild(editBadge)
      }

      fragment.appendChild(thumb)
    })

    grid.appendChild(fragment)
  }

  _updateLiveState() {
    const liveIdx = state.get('liveSlideIndex')
    const liveContentId = state.get('layers')?.slide?.content?.id
    const pres = state.get('selectedPresentation')
    const sequence = pres ? getActiveSequence(pres) : []
    this.container.querySelectorAll('.slide-thumbnail').forEach((thumb, i) => {
      // Match by identity too, so the LIVE badge doesn't stick to whatever
      // slide happens to sit at the previous presentation's live index.
      const isLive =
        i === liveIdx && liveContentId && sequence[i]?.id === liveContentId
      thumb.classList.toggle('live', isLive)
    })
  }

  _updateActiveState() {
    const activeIdx = state.get('activeSlideIndex')
    const liveIdx = state.get('liveSlideIndex')
    this.container.querySelectorAll('.slide-thumbnail').forEach((thumb, i) => {
      if (i !== liveIdx) {
        thumb.classList.toggle('active', i === activeIdx)
      }
    })
  }

  _bindEvents() {
    // Single click: go live
    this.container.addEventListener('click', (e) => {
      const thumb = e.target.closest('.slide-thumbnail')
      if (!thumb) return
      const index = parseInt(thumb.dataset.index, 10)
      if (!isNaN(index)) goLive(index)
    })

    // Double-click: open announcement quick-editor for announcement slides
    this.container.addEventListener('dblclick', (e) => {
      const thumb = e.target.closest('.slide-thumbnail')
      if (!thumb) return

      const sequenceIndex = parseInt(thumb.dataset.index, 10)
      const pres = state.get('selectedPresentation')
      if (!pres || isNaN(sequenceIndex)) return

      // AnnouncementEditor edits the underlying slide by its position in
      // pres.slides, not its position in the (possibly repeating) arrangement
      // sequence — resolve the clicked occurrence back to that master index.
      const sequenceSlide = getActiveSequence(pres)[sequenceIndex]
      const index = sequenceSlide ? pres.slides.findIndex((s) => s.id === sequenceSlide.id) : -1
      if (index === -1) return

      const slide = pres.slides[index]
      if (slide && slide.type === 'announcement') {
        announcementEditor.open(index)
      } else {
        state.set('activeSlideIndex', sequenceIndex)
        state.set('isEditing', true)
      }
    })
  }
}
