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
      <div class="panel-header__actions">
        ${pres ? `<span class="text-muted text-xs">${pres.slides.length} slides</span>` : ''}
      </div>
    `
    this.container.appendChild(header)

    // Slide grid
    const grid = document.createElement('div')
    grid.className = 'slide-grid'
    grid.id = 'slide-grid'
    this.container.appendChild(grid)

    this._renderSlides()
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
          <div class="empty-state__text">Select a presentation from the library<br>or playlist to view slides</div>
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
      
      // Generate a high-fidelity scaled JPEG data URL of the slide text
      const imgUrl = NativeRender.generateThumbnailDataUrl(slide.text || '', {
        fontSize: 48,
        bold: true,
        strokeWidth: 4,
        strokeColor: '#000000',
        hasShadow: true,
        shadowOffsetX: 3,
        shadowOffsetY: 3,
        color: '#FFFFFF'
      })
      
      content.style.backgroundImage = `url(${imgUrl})`
      content.style.backgroundSize = 'contain'
      content.style.backgroundPosition = 'center'
      content.style.backgroundRepeat = 'no-repeat'
      content.style.backgroundColor = '#000000'
      
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
