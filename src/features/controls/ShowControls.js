import { state } from '../../core/StateManager.js'
import { timerEngine } from '../../services/TimerEngine.js'
import { icon } from '../../components/common/Icons.js'
import { renderTimers } from './tabs/TimersTab.js'
import { renderMessages } from './tabs/MessagesTab.js'
import { renderProps } from './tabs/PropsTab.js'
import { renderMacros } from './tabs/MacrosTab.js'
import { renderStage } from './tabs/StageTab.js'
import { renderGame } from './tabs/GameTab.js'
import { renderScheduler } from './tabs/SchedulerTab.js'
import { renderWorkspaceMenu } from './WorkspaceMenu.js'

const HIDDEN_TABS_KEY = 'easyPresentHiddenTabs'

/** Tabs to show: everything not switched off, but never none, and never the one you are on. */
export function visibleTabDefs(defs, hidden, activeKey) {
  const hide = new Set(hidden || [])
  const shown = defs.filter((t) => !hide.has(t.key) || t.key === activeKey)
  return shown.length ? shown : defs.slice(0, 1)
}

/**
 * ShowControls — Bottom-right panel with tabs for Timers, Messages, Props, Macros, Stage
 */
export class ShowControls {
  constructor(container) {
    this.container = container
    try {
      const saved = JSON.parse(localStorage.getItem(HIDDEN_TABS_KEY))
      if (Array.isArray(saved)) state.set('hiddenControlTabs', saved.filter((k) => typeof k === 'string'))
    } catch { /* private window or damaged value: show everything */ }
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
      { key: 'game', icon: 'gamepad2', label: 'Game' },
      { key: 'scheduler', icon: 'calendarDays', label: 'Schedule' }
    ]

    this.tabDefs = tabDefs
    const activeTab = state.get('activeControlTab')

    visibleTabDefs(tabDefs, state.get('hiddenControlTabs'), activeTab).forEach((t) => {
      const tab = document.createElement('button')
      tab.className = `tab ${activeTab === t.key ? 'active' : ''}`
      tab.dataset.tab = t.key
      tab.id = `control-tab-${t.key}`
      tab.innerHTML = `${icon(t.icon, 12).outerHTML}<span>${t.label}</span>`
      tabs.appendChild(tab)
    })

    const customize = document.createElement('button')
    customize.className = 'tab'
    customize.id = 'control-tabs-customize'
    customize.title = 'Choose which tabs to show'
    customize.setAttribute('aria-label', 'Choose which tabs to show')
    customize.setAttribute('aria-expanded', 'false')
    customize.textContent = '⋯'
    tabs.appendChild(customize)

    this.container.appendChild(tabs)

    // Tab content
    const content = document.createElement('div')
    content.className = 'panel-content show-controls-content'
    content.id = 'show-controls-content'
    this.container.appendChild(content)

    this._renderTabContent(activeTab)
  }

  /** Switches a tab on or off. The tab you are on, and the last visible one, cannot be switched off. */
  _setTabHidden(key, hidden) {
    const current = new Set(state.get('hiddenControlTabs') || [])
    if (hidden) {
      const stillVisible = this.tabDefs.filter((t) => !current.has(t.key) && t.key !== key)
      if (!stillVisible.length || key === state.get('activeControlTab')) return this._renderTabMenu()
      current.add(key)
    } else {
      current.delete(key)
    }
    const next = [...current]
    state.set('hiddenControlTabs', next)
    try { localStorage.setItem(HIDDEN_TABS_KEY, JSON.stringify(next)) } catch { /* private window */ }
    this.render()
    this._renderTabMenu(true)
  }

  _toggleTabMenu() {
    const open = !!this.container.querySelector('#control-tabs-menu')
    if (open) {
      this.container.querySelector('#control-tabs-menu').remove()
      this.container.querySelector('#control-tabs-customize')?.setAttribute('aria-expanded', 'false')
    } else {
      this._renderTabMenu(true)
    }
  }

  _renderTabMenu(open = false) {
    const existing = this.container.querySelector('#control-tabs-menu')
    if (!open && !existing) return
    existing?.remove()
    const hidden = new Set(state.get('hiddenControlTabs') || [])
    const active = state.get('activeControlTab')
    const menu = document.createElement('div')
    menu.id = 'control-tabs-menu'
    menu.style.cssText = 'padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px 14px;border-bottom:1px solid var(--border-color);font-size:12px;color:var(--text-secondary);'
    this.tabDefs.forEach((t) => {
      const label = document.createElement('label')
      label.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;'
      const box = document.createElement('input')
      box.type = 'checkbox'
      box.dataset.tabToggle = t.key
      box.checked = !hidden.has(t.key)
      box.disabled = t.key === active // you are looking at it
      label.append(box, document.createTextNode(t.label))
      menu.appendChild(label)
    })
    // Saved layouts live in the same menu
    const layouts = document.createElement('div')
    layouts.id = 'control-layouts'
    layouts.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%;margin-top:6px;padding-top:6px;border-top:1px solid var(--border-color);'
    menu.appendChild(layouts)
    renderWorkspaceMenu(layouts, {
      onApplied: () => {
        this.render() // tabs and their content follow the applied layout
        this._renderTabMenu(true)
      }
    })

    const tabs = this.container.querySelector('#show-controls-tabs')
    tabs.after(menu)
    this.container.querySelector('#control-tabs-customize')?.setAttribute('aria-expanded', 'true')
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
      case 'game':
        this._tabCleanup = renderGame(content)
        break
      case 'scheduler':
        renderScheduler(content)
        break
    }
  }

  _bindEvents() {
    // Tab switching
    this.container.addEventListener('click', (e) => {
      if (e.target.closest('#control-tabs-customize')) {
        this._toggleTabMenu()
        return
      }
      const tabToggle = e.target.closest('[data-tab-toggle]')
      if (tabToggle) {
        this._setTabHidden(tabToggle.dataset.tabToggle, !tabToggle.checked)
        return
      }
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
        this._timerMinutes = minutes // Reset goes back to this, not always 5
        const display = this.container.querySelector('.timer-display__time')
        if (display) {
          display.textContent = `${String(minutes).padStart(2, '0')}:00`
        }
      }

      // Message templates
      const msgItem = e.target.closest('[data-msg]')
      if (msgItem) {
        const input = this.container.querySelector('#message-input')
        if (input) {
          input.value = msgItem.dataset.msg
          input.dispatchEvent(new window.Event('input', { bubbles: true })) // keeps the draft in step
        }
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
        timerEngine.reset('main', this._timerMinutes ?? 5)
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
