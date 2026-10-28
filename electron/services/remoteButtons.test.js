import { describe, it, expect, afterAll } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { io as Client } from 'socket.io-client'

const require = createRequire(import.meta.url)
const { COMMANDS, sanitizeButtons, defaultButtons, MAX_BUTTONS } = require('./remoteButtons.js')

describe('sanitizeButtons', () => {
  it('keeps good buttons in the order given', () => {
    const out = sanitizeButtons([
      { cmd: 'logo', label: 'Show logo', big: true },
      { cmd: 'next', label: 'GO' }
    ])
    expect(out).toEqual([
      { cmd: 'logo', label: 'Show logo', big: true },
      { cmd: 'next', label: 'GO', big: false }
    ])
  })

  it('drops unknown commands and duplicates, trims and caps labels, falls back to the default label', () => {
    const out = sanitizeButtons([
      { cmd: 'format-disk', label: 'x' },
      { cmd: 'next', label: '   ' },
      { cmd: 'next', label: 'again' },
      { cmd: 'prev', label: 'a'.repeat(50) },
      null,
      'next'
    ])
    expect(out.map((b) => b.cmd)).toEqual(['next', 'prev'])
    expect(out[0].label).toBe('Next ▶')
    expect(out[1].label).toHaveLength(20)
  })

  it('caps the list and never returns an empty remote', () => {
    const many = [...COMMANDS, ...COMMANDS].map((cmd) => ({ cmd }))
    expect(sanitizeButtons(many).length).toBeLessThanOrEqual(MAX_BUTTONS)
    expect(sanitizeButtons([])).toEqual(defaultButtons())
    expect(sanitizeButtons('nope')).toEqual(defaultButtons())
    expect(sanitizeButtons([{ cmd: 'nope' }])).toEqual(defaultButtons())
  })
})

describe('the hub and the remote', () => {
  process.env.EASYPRESENT_PORT = '18432'
  const { createStageHub } = require('./stageHub.js')
  const hub = createStageHub()
  afterAll(() => hub.unshare())

  const nextConfig = (c) => new Promise((resolve) => c.once('remote-config', resolve))

  it('sends a new client the current buttons, and every client the new ones when they change', async () => {
    const port = await hub.start()
    hub.setRemoteButtons([{ cmd: 'nextSong', label: 'Skip song', big: true }])
    const c = Client(`http://localhost:${port}`)
    expect(await nextConfig(c)).toEqual([{ cmd: 'nextSong', label: 'Skip song', big: true }])

    const changed = nextConfig(c)
    hub.setRemoteButtons([{ cmd: 'hideAudienceText', label: 'Sermon' }, { cmd: 'bogus' }])
    expect(await changed).toEqual([{ cmd: 'hideAudienceText', label: 'Sermon', big: false }])
    c.disconnect()
  })

  it('relays the new commands once the PIN checks out', async () => {
    const port = await hub.start()
    const got = []
    hub.setRemoteHandler((cmd) => got.push(cmd))
    const c = Client(`http://localhost:${port}`)
    await new Promise((r) => c.on('connect', r))
    const ask = (msg) => new Promise((r) => c.emit('remote-command', msg, r))
    const pin = hub.status().pin
    expect((await ask({ cmd: 'prevSong', pin })).ok).toBe(true)
    expect((await ask({ cmd: 'clearSlide', pin })).ok).toBe(true)
    expect((await ask({ cmd: 'hideAudienceText', pin })).ok).toBe(true)
    expect(got).toEqual(['prevSong', 'clearSlide', 'hideAudienceText'])
    c.disconnect()
  })
})

describe('the remote page', () => {
  it('draws buttons from the config it receives, grouped into rows by size', async () => {
    const { JSDOM } = await import('jsdom')
    const html = fs.readFileSync(path.join(__dirname, '../../public/remote/index.html'), 'utf8').replace(/<script src="socket.io.min.js"><\/script>/, '')
    const handlers = {}
    const sent = []
    const dom = new JSDOM(html, { runScripts: 'outside-only' })
    dom.window.io = () => ({ on: (e, f) => (handlers[e] = f), emit: (...a) => sent.push(a) })
    const script = html.match(/<script>([\s\S]*)<\/script>/)[1]
    dom.window.eval(script)

    handlers['remote-config']([
      { cmd: 'prev', label: 'Back', big: true },
      { cmd: 'next', label: 'Go', big: true },
      { cmd: 'logo', label: 'Logo' },
      { cmd: 'clear', label: 'Clear' },
      { cmd: 'nextSong', label: 'Skip' },
      { cmd: 'prevSong', label: 'Undo skip' }
    ])
    const rows = [...dom.window.document.querySelectorAll('#buttons .row')]
    expect(rows.map((r) => r.children.length)).toEqual([2, 3, 1])
    const go = dom.window.document.querySelector('[data-cmd="next"]')
    expect(go.textContent).toBe('Go')
    expect(go.className).toContain('big')

    go.click()
    expect(sent.at(-1)[0]).toBe('remote-command')
    expect(sent.at(-1)[1].cmd).toBe('next')

    handlers['remote-config']([{ cmd: 'logo', label: 'Only' }])
    expect(dom.window.document.querySelectorAll('#buttons button')).toHaveLength(1)
    dom.window.close()
  })

  it('escapes labels (they are shown as text, never as markup)', async () => {
    const { JSDOM } = await import('jsdom')
    const html = fs.readFileSync(path.join(__dirname, '../../public/remote/index.html'), 'utf8').replace(/<script src="socket.io.min.js"><\/script>/, '')
    const handlers = {}
    const dom = new JSDOM(html, { runScripts: 'outside-only' })
    dom.window.io = () => ({ on: (e, f) => (handlers[e] = f), emit() {} })
    dom.window.eval(html.match(/<script>([\s\S]*)<\/script>/)[1])
    handlers['remote-config']([{ cmd: 'next', label: '<img src=x onerror=alert(1)>' }])
    expect(dom.window.document.querySelector('#buttons img')).toBeNull()
    expect(dom.window.document.querySelector('#buttons button').textContent).toContain('<img')
    dom.window.close()
  })
})
