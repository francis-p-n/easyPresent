import { state } from '../../engine/StateManager.js'
import { timerEngine } from '../../engine/TimerEngine.js'
import { icon } from '../../components/common/Icons.js'
import { renderTimers } from './tabs/TimersTab.js'
import { renderMessages } from './tabs/MessagesTab.js'
import { renderProps } from './tabs/PropsTab.js'
import { renderMacros } from './tabs/MacrosTab.js'
import { renderStage } from './tabs/StageTab.js'

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
      { key: 'stage', icon: 'tv', label: 'Stage' }
    ]

    const activeTab = state.get('activeControlTab')

    tabDefs.forEach((t) => {
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

    // Cleanup previous tab if it returns a cleanup function
    if (this._tabCleanup) {
      this._tabCleanup()
      this._tabCleanup = null
    }

    switch (tab) {
      case 'timers':
        this._tabCleanup = renderTimers(content, this.container)
        break
      case 'messages':
        renderMessages(content)
        break
      case 'props':
        renderProps(content)
        break
      case 'macros':
        renderMacros(content)
        break
      case 'stage':
        this._tabCleanup = renderStage(content)
        break
    }
  }

  _bindEvents() {
    // Tab switching
    this.container.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab')
      if (tab) {
        const key = tab.dataset.tab
        state.set('activeControlTab', key)
        this.container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'))
        tab.classList.add('active')
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
        const minutes = parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60
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
