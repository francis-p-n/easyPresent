import { state } from '../engine/StateManager.js'
import { timerEngine } from '../engine/TimerEngine.js'
import { icon } from './Icons.js'

/**
 * ShowControls — Bottom-right panel with tabs for Timers, Messages, Props, Macros, Stage
 */
export class ShowControls {
  constructor(container) {
    this.container = container
    this.render()
    this._bindEvents()
  }

  render() {
    this.container.innerHTML = ''

    // Tabs
    const tabs = document.createElement('div')
    tabs.className = 'tabs'
    tabs.id = 'show-controls-tabs'

    const tabDefs = [
      { key: 'timers', icon: 'clock', label: 'Timers' },
      { key: 'messages', icon: 'messageSquare', label: 'Messages' },
      { key: 'props', icon: 'layers', label: 'Props' },
      { key: 'macros', icon: 'zap', label: 'Macros' },
      { key: 'stage', icon: 'tv', label: 'Stage' },
    ]

    const activeTab = state.get('activeControlTab')

    tabDefs.forEach(t => {
      const tab = document.createElement('button')
      tab.className = `tab ${activeTab === t.key ? 'active' : ''}`
      tab.dataset.tab = t.key
      tab.id = `control-tab-${t.key}`
      tab.innerHTML = `${icon(t.icon, 12).outerHTML}<span>${t.label}</span>`
      tabs.appendChild(tab)
    })

    this.container.appendChild(tabs)

    // Tab content
    const content = document.createElement('div')
    content.className = 'panel-content show-controls-content'
    content.id = 'show-controls-content'
    this.container.appendChild(content)

    this._renderTabContent(activeTab)
  }

  _renderTabContent(tab) {
    const content = this.container.querySelector('#show-controls-content')
    if (!content) return

    switch (tab) {
      case 'timers':
        content.innerHTML = `
          <div class="show-controls-section">
            <div class="timer-display" id="timer-display">
              <div class="timer-display__time">00:00</div>
              <div class="timer-display__label">Countdown Timer</div>
            </div>
            <div class="timer-controls">
              <button class="btn btn--primary" id="timer-start">Start</button>
              <button class="btn" id="timer-stop">Stop</button>
              <button class="btn" id="timer-reset">Reset</button>
            </div>
            <div class="timer-presets">
              <button class="btn timer-preset" data-minutes="1">1 min</button>
              <button class="btn timer-preset" data-minutes="3">3 min</button>
              <button class="btn timer-preset" data-minutes="5">5 min</button>
              <button class="btn timer-preset" data-minutes="10">10 min</button>
            </div>
          </div>
        `
        
        // Listen for timer updates
        state.on('timer_main', (timeStr) => {
          const display = this.container.querySelector('.timer-display__time')
          if (display) display.textContent = timeStr
        })
        break

      case 'messages':
        content.innerHTML = `
          <div class="show-controls-section">
            <div class="message-form">
              <input type="text" class="input" placeholder="Enter message text..." id="message-input" />
              <button class="btn btn--primary" id="message-show">Show</button>
              <button class="btn" id="message-hide">Hide</button>
            </div>
            <div class="message-templates">
              <div class="list-item" data-msg="Welcome! We're glad you're here.">
                ${icon('messageSquare', 14).outerHTML}
                <span>Welcome Message</span>
              </div>
              <div class="list-item" data-msg="Service starting in {timer}">
                ${icon('messageSquare', 14).outerHTML}
                <span>Service Starting</span>
              </div>
              <div class="list-item" data-msg="Please silence your phones">
                ${icon('messageSquare', 14).outerHTML}
                <span>Silence Phones</span>
              </div>
            </div>
          </div>
        `
        break

      case 'props':
        content.innerHTML = `
          <div class="show-controls-section">
            <div class="empty-state">
              ${icon('layers', 48).outerHTML}
              <div class="empty-state__text" style="margin-bottom: var(--spacing-sm);">No props configured<br>Add logos, lower thirds, and overlays</div>
              <button class="btn btn--primary">${icon('plus', 14).outerHTML} Add Prop</button>
            </div>
          </div>
        `
        break

      case 'macros':
        content.innerHTML = `
          <div class="show-controls-section">
            <div class="macro-grid">
              <button class="macro-btn" data-macro="worship-look">
                <span class="macro-btn__icon" style="background: var(--bg-hover); color: var(--accent-blue);">${icon('tv', 18).outerHTML}</span>
                <span>Worship Look</span>
              </button>
              <button class="macro-btn" data-macro="sermon-look">
                <span class="macro-btn__icon" style="background: var(--bg-hover); color: var(--group-bridge);">${icon('messageSquare', 18).outerHTML}</span>
                <span>Sermon Look</span>
              </button>
              <button class="macro-btn" data-macro="clear-all">
                <span class="macro-btn__icon" style="background: var(--bg-hover); color: var(--accent-red);">${icon('x', 18).outerHTML}</span>
                <span>Clear All</span>
              </button>
              <button class="macro-btn" data-macro="pre-service">
                <span class="macro-btn__icon" style="background: var(--bg-hover); color: var(--accent-green);">${icon('clock', 18).outerHTML}</span>
                <span>Pre-Service</span>
              </button>
            </div>
          </div>
        `
        break

      case 'stage':
        content.innerHTML = `
          <div class="show-controls-section">
            <div class="stage-preview">
              <div class="stage-preview__label">Stage Display Preview</div>
              <div class="stage-preview__screen" id="stage-preview-screen">
                <div class="stage-preview__current">Current slide text will appear here</div>
                <div class="stage-preview__next">Next: Next slide text</div>
                <div class="stage-preview__clock" id="stage-clock">00:00:00</div>
              </div>
            </div>
            <div class="stage-controls">
              <button class="btn" id="stage-edit-layout">${icon('edit', 14).outerHTML} Edit Layout</button>
              <button class="btn btn--primary" id="stage-open-window">${icon('monitor', 14).outerHTML} Open Stage Window</button>
            </div>
          </div>
        `
        // Start clock
        this._startClock()
        break
    }
  }

  _startClock() {
    const clockEl = document.getElementById('stage-clock')
    if (!clockEl) return
    const update = () => {
      const now = new Date()
      clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false })
    }
    update()
    this._clockInterval = setInterval(update, 1000)
  }

  _bindEvents() {
    // Tab switching
    this.container.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab')
      if (tab) {
        const key = tab.dataset.tab
        state.set('activeControlTab', key)
        this.container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
        tab.classList.add('active')
        if (this._clockInterval) clearInterval(this._clockInterval)
        this._renderTabContent(key)
        return
      }

      // Timer presets
      const preset = e.target.closest('.timer-preset')
      if (preset) {
        const minutes = parseInt(preset.dataset.minutes, 10)
        const display = this.container.querySelector('.timer-display__time')
        if (display) {
          display.textContent = `${String(minutes).padStart(2, '0')}:00`
        }
      }

      // Message templates
      const msgItem = e.target.closest('[data-msg]')
      if (msgItem) {
        const input = this.container.querySelector('#message-input')
        if (input) input.value = msgItem.dataset.msg
      }

      // Timer Actions
      if (e.target.id === 'timer-start') {
        const display = this.container.querySelector('.timer-display__time')
        const parts = display.textContent.split(':')
        const minutes = parseInt(parts[0], 10) + parseInt(parts[1], 10)/60
        timerEngine.startCountdown('main', minutes)
      } else if (e.target.id === 'timer-stop') {
        timerEngine.stop('main')
      } else if (e.target.id === 'timer-reset') {
        timerEngine.reset('main', 5)
      }

      // Message Actions
      if (e.target.id === 'message-show') {
        const input = this.container.querySelector('#message-input')
        if (input && input.value) {
          const layers = { ...state.get('layers') }
          layers.message = { active: true, content: input.value }
          state.set('layers', layers)
        }
      } else if (e.target.id === 'message-hide') {
        const layers = { ...state.get('layers') }
        layers.message = { active: false, content: null }
        state.set('layers', layers)
      }

      // Stage Display Actions
      const stageOpenBtn = e.target.closest('#stage-open-window')
      if (stageOpenBtn) {
        if (window.electronAPI && window.electronAPI.createStageDisplay) {
          window.electronAPI.createStageDisplay()
        } else {
          console.warn('Stage Display requires Electron environment.')
        }
      }
    })
  }
}
