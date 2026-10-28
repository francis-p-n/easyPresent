import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  cleanRemoteButtons,
  loadRemoteButtons,
  applyRemoteButtons,
  mountRemoteButtonsEditor,
  syncRemoteButtons,
  REMOTE_BUTTONS_KEY,
  DEFAULT_REMOTE_BUTTONS
} from './RemoteButtonsEditor.js'

let host, sent

const rowFor = (cmd) => host.querySelector(`[data-cmd="${cmd}"]`)
const order = () => [...host.querySelectorAll('[data-cmd]')].filter((r) => r.querySelector('.rb-on').checked).map((r) => r.dataset.cmd)
const stored = () => JSON.parse(localStorage.getItem(REMOTE_BUTTONS_KEY))

beforeEach(() => {
  localStorage.clear()
  sent = []
  window.electronAPI = { setRemoteButtons: (list) => sent.push(list) }
  host = document.createElement('div')
  document.body.appendChild(host)
})
afterEach(() => {
  delete window.electronAPI
  host.remove()
})

describe('cleanRemoteButtons', () => {
  it('falls back to the default four for anything unusable', () => {
    for (const junk of [null, undefined, 'x', [], [{ cmd: 'nope' }]]) expect(cleanRemoteButtons(junk)).toEqual(DEFAULT_REMOTE_BUTTONS)
  })
  it('drops unknown and duplicate commands and tidies labels', () => {
    const out = cleanRemoteButtons([{ cmd: 'logo', label: '  Big logo  ', big: 1 }, { cmd: 'logo' }, { cmd: 'zzz' }, { cmd: 'next', label: '' }])
    expect(out).toEqual([
      { cmd: 'logo', label: 'Big logo', big: true },
      { cmd: 'next', label: 'Next ▶', big: false }
    ])
  })
  it('reads a damaged saved value as the defaults', () => {
    localStorage.setItem(REMOTE_BUTTONS_KEY, '{oops')
    expect(loadRemoteButtons()).toEqual(DEFAULT_REMOTE_BUTTONS)
  })
})

describe('RemoteButtonsEditor', () => {
  it('starts with the four default buttons ticked, in order, and the rest available', () => {
    mountRemoteButtonsEditor(host)
    expect(order()).toEqual(['prev', 'next', 'clear', 'logo'])
    expect(host.querySelectorAll('[data-cmd]')).toHaveLength(8)
    expect(rowFor('nextSong').querySelector('.rb-on').checked).toBe(false)
  })

  it('adding a button saves it and sends the list to the server', () => {
    mountRemoteButtonsEditor(host)
    const box = rowFor('nextSong').querySelector('.rb-on')
    box.checked = true
    box.dispatchEvent(new window.Event('change'))
    expect(order()).toEqual(['prev', 'next', 'clear', 'logo', 'nextSong'])
    expect(stored().map((b) => b.cmd)).toEqual(['prev', 'next', 'clear', 'logo', 'nextSong'])
    expect(sent.at(-1).map((b) => b.cmd)).toEqual(['prev', 'next', 'clear', 'logo', 'nextSong'])
  })

  it('renames and enlarges a button', () => {
    mountRemoteButtonsEditor(host)
    const label = rowFor('logo').querySelector('.rb-label')
    label.value = 'Welcome screen'
    label.dispatchEvent(new window.Event('change'))
    const big = rowFor('logo').querySelector('.rb-big')
    big.checked = true
    big.dispatchEvent(new window.Event('change'))
    expect(stored().find((b) => b.cmd === 'logo')).toEqual({ cmd: 'logo', label: 'Welcome screen', big: true })
  })

  it('reorders with the arrows and disables them at the ends', () => {
    mountRemoteButtonsEditor(host)
    expect(rowFor('prev').querySelector('.rb-up').disabled).toBe(true)
    expect(rowFor('logo').querySelector('.rb-down').disabled).toBe(true)
    rowFor('logo').querySelector('.rb-up').click()
    expect(order()).toEqual(['prev', 'next', 'logo', 'clear'])
    expect(stored().map((b) => b.cmd)).toEqual(['prev', 'next', 'logo', 'clear'])
  })

  it('removing a button takes it off the list but never lets the last one go', () => {
    mountRemoteButtonsEditor(host)
    for (const cmd of ['prev', 'next', 'clear']) {
      const box = rowFor(cmd).querySelector('.rb-on')
      box.checked = false
      box.dispatchEvent(new window.Event('change'))
    }
    expect(order()).toEqual(['logo'])
    const last = rowFor('logo').querySelector('.rb-on')
    last.checked = false
    last.dispatchEvent(new window.Event('change'))
    expect(order()).toEqual(['logo']) // put back
    expect(stored()).toHaveLength(1)
  })

  it('reopens with what was saved, and works without the desktop bridge', () => {
    applyRemoteButtons([{ cmd: 'hideAudienceText', label: 'Sermon', big: true }])
    delete window.electronAPI
    mountRemoteButtonsEditor(host)
    expect(order()).toEqual(['hideAudienceText'])
    expect(rowFor('hideAudienceText').querySelector('.rb-label').value).toBe('Sermon')
    const box = rowFor('next').querySelector('.rb-on')
    box.checked = true
    expect(() => box.dispatchEvent(new window.Event('change'))).not.toThrow()
  })

  it('syncRemoteButtons pushes the saved list at startup', () => {
    applyRemoteButtons([{ cmd: 'next', label: 'Go', big: false }])
    sent.length = 0
    syncRemoteButtons()
    expect(sent).toEqual([[{ cmd: 'next', label: 'Go', big: false }]])
  })
})
