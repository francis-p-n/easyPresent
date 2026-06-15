import { state } from '../engine/StateManager.js'
import { icon } from './Icons.js'
import NativeRender from '../engine/NativeRender.js'

/**
 * SlideView — Center panel showing slide thumbnails in a grid
 */
export class SlideView {
  constructor(container) {
    this.container = container
    this.render()
    this._bindEvents()

    state.on('slides', () => this._renderSlides())
    state.on('selectedPresentation', () => this.render())
    state.on('liveSlideIndex', () => this._updateLiveState())
    state.on('activeSlideIndex', () => this._updateActiveState())
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
        ${pres && pres.linkedAudio ? `
          <button class="btn btn--icon" id="play-rehearsal-audio" title="Play Rehearsal Audio" style="color: var(--primary-color);">
            ${icon('play', 14).outerHTML}
          </button>
          <audio id="rehearsal-audio-player" src="${pres.linkedAudio}" style="display:none;"></audio>
        ` : ''}
        ${pres && pres.slides.some(s => s.linesData && s.linesData.some(l => l.chords && l.chords.length > 0)) ? `
          <label style="font-size:12px; display:flex; align-items:center; gap:4px; cursor:pointer;">
            <input type="checkbox" id="toggle-chords-checkbox" /> Show Chords
          </label>
        ` : ''}
        ${pres ? `<span class="text-muted text-xs">${pres.slides.length} slides</span>` : ''}
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
    chordSheet.innerHTML = ''
    const pres = state.get('selectedPresentation')
    if (!pres) return

    pres.slides.forEach(slide => {
      const block = document.createElement('div')
      block.style.marginBottom = '24px'
      
      if (slide.label) {
        const label = document.createElement('div')
        label.style.fontWeight = 'bold'
        label.style.color = 'var(--primary-color)'
        label.style.marginBottom = '12px'
        label.textContent = slide.label
        block.appendChild(label)
      }

      if (slide.linesData && slide.linesData.length > 0) {
        slide.linesData.forEach(line => {
          const lineDiv = document.createElement('div')
          lineDiv.style.marginBottom = '12px'
          lineDiv.style.position = 'relative'
          lineDiv.style.lineHeight = '1.4'
          
          if (line.chords && line.chords.length > 0) {
            const chordsDiv = document.createElement('div')
            chordsDiv.style.color = '#4ea8de' // blueish chords
            chordsDiv.style.fontWeight = 'bold'
            chordsDiv.style.height = '1.2em'
            chordsDiv.style.whiteSpace = 'pre'
            
            // Build chord line with spaces
            let chordLine = ''
            let lastPos = 0
            line.chords.forEach(c => {
              const spaces = Math.max(0, c.pos - lastPos)
              chordLine += ' '.repeat(spaces) + c.chord
              lastPos = c.pos + c.chord.length
            })
            chordsDiv.textContent = chordLine
            lineDiv.appendChild(chordsDiv)
          }

          const textDiv = document.createElement('div')
          textDiv.style.whiteSpace = 'pre'
          textDiv.textContent = line.text || ' ' // keep space if empty
          lineDiv.appendChild(textDiv)
          
          block.appendChild(lineDiv)
        })
      } else {
        // Fallback for presentations without linesData
        const textDiv = document.createElement('div')
        textDiv.style.whiteSpace = 'pre-wrap'
        textDiv.textContent = slide.text
        block.appendChild(textDiv)
      }

      chordSheet.appendChild(block)
    })
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
          <button class="btn btn--primary">${icon('plus', 14).outerHTML} Create Presentation</button>
        </div>
      `
      return
    }

    const liveIdx = state.get('liveSlideIndex')
    const activeIdx = state.get('activeSlideIndex')

    pres.slides.forEach((slide, index) => {
      const thumb = document.createElement('div')
      thumb.className = 'slide-thumbnail'
      thumb.dataset.index = index
      thumb.id = `slide-thumb-${index}`

      if (index === liveIdx) thumb.classList.add('live')
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
      const activeTheme = themes.find(t => t.id === activeThemeId) || themes[0]

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

      // Generate a high-fidelity scaled JPEG data URL of the slide text
      const imgUrl = NativeRender.generateThumbnailDataUrl(slide.text || '', styleOpts)
      
      content.style.backgroundImage = `url(${imgUrl})`
      content.style.backgroundSize = 'contain'
      content.style.backgroundPosition = 'center'
      content.style.backgroundRepeat = 'no-repeat'
      content.style.backgroundColor = styleOpts.backgroundColor || '#000000'
      
      thumb.appendChild(content)


      // Slide number
      const num = document.createElement('div')
      num.className = 'slide-thumbnail__number'
      num.textContent = index + 1
      thumb.appendChild(num)

      grid.appendChild(thumb)
    })
  }

  _updateLiveState() {
    const liveIdx = state.get('liveSlideIndex')
    this.container.querySelectorAll('.slide-thumbnail').forEach((thumb, i) => {
      thumb.classList.toggle('live', i === liveIdx)
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
    // Click to trigger slide live
    this.container.addEventListener('click', (e) => {
      const thumb = e.target.closest('.slide-thumbnail')
      if (!thumb) return

      const index = parseInt(thumb.dataset.index, 10)
      const pres = state.get('selectedPresentation')
      if (!pres || isNaN(index)) return

      // Set live
      state.set('liveSlideIndex', index)
      state.set('activeSlideIndex', index)

      // Update layers
      const layers = { ...state.get('layers') }
      layers.slide = { active: true, content: pres.slides[index] }
      state.set('layers', layers)
    })
  }
}
