import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { state } from '../../core/StateManager.js'
import { ShowControls, visibleTabDefs } from './ShowControls.js'

let container, controls
const tabKeys = () => [...container.querySelectorAll('#show-controls-tabs .tab[data-tab]')].map((t) => t.dataset.tab)
const toggle = (key) => container.querySelector(`[data-tab-toggle="${key}"]`)

beforeEach(() => {
  localStorage.clear()
  state.set('hiddenControlTabs', [])
  state.set('activeControlTab', 'timers')
  container = document.createElement('div')
  document.body.appendChild(container)
  controls = new ShowControls(container)
})
afterEach(() => {
  controls._tabCleanup?.()
  container.remove()
})

describe('visibleTabDefs', () => {
  const defs = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]
  it('hides what is switched off but keeps the active tab', () => {
    expect(visibleTabDefs(defs, ['a', 'b'], 'c').map((t) => t.key)).toEqual(['c'])
    expect(visibleTabDefs(defs, ['a'], 'a').map((t) => t.key)).toEqual(['a', 'b', 'c'])
  })
  it('never returns an empty list', () => {
    expect(visibleTabDefs(defs, ['a', 'b', 'c'], 'zzz').map((t) => t.key)).toEqual(['a'])
    expect(visibleTabDefs(defs, undefined, 'a')).toHaveLength(3)
  })
})

describe('ShowControls — choosing tabs', () => {
  it('shows every tab by default', () => {
    expect(tabKeys()).toEqual(['timers', 'messages', 'props', 'macros', 'stage', 'game', 'scheduler'])
  })

  it('opens a menu from the ⋯ button and switches a tab off and on again', () => {
    container.querySelector('#control-tabs-customize').click()
    expect(container.querySelector('#control-tabs-menu')).not.toBeNull()

    toggle('macros').click() // jsdom flips checked, then our handler reads it
    expect(tabKeys()).not.toContain('macros')
    expect(container.querySelector('#control-tabs-menu')).not.toBeNull() // stays open for more changes
    expect(JSON.parse(localStorage.getItem('easyPresentHiddenTabs'))).toEqual(['macros'])

    toggle('macros').click()
    expect(tabKeys()).toContain('macros')
    expect(JSON.parse(localStorage.getItem('easyPresentHiddenTabs'))).toEqual([])
  })

  it('does not let the tab you are on be switched off', () => {
    container.querySelector('#control-tabs-customize').click()
    expect(toggle('timers').disabled).toBe(true)
    controls._setTabHidden('timers', true)
    expect(tabKeys()).toContain('timers')
  })

  it('does not let the last visible tab be switched off', () => {
    for (const key of ['messages', 'props', 'macros', 'stage', 'game', 'scheduler']) controls._setTabHidden(key, true)
    expect(tabKeys()).toEqual(['timers'])
    controls._setTabHidden('timers', true)
    expect(tabKeys()).toEqual(['timers'])
  })

  it('remembers the choice on the next launch', () => {
    controls._setTabHidden('game', true)
    controls._tabCleanup?.()
    state.set('hiddenControlTabs', [])
    container.innerHTML = ''
    controls = new ShowControls(container)
    expect(tabKeys()).not.toContain('game')
  })

  it('ignores a damaged saved value', () => {
    localStorage.setItem('easyPresentHiddenTabs', '{not json')
    state.set('hiddenControlTabs', [])
    container.innerHTML = ''
    controls = new ShowControls(container)
    expect(tabKeys()).toHaveLength(7)
  })

  it('the ⋯ button toggles the menu closed again and does not switch tabs', () => {
    const btn = container.querySelector('#control-tabs-customize')
    btn.click()
    btn.click()
    expect(container.querySelector('#control-tabs-menu')).toBeNull()
    expect(state.get('activeControlTab')).toBe('timers')
  })
})
