// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Module from 'node:module'

/**
 * Integration test for electron/main.js's IPC handlers, especially the
 * audience-output window (new) and the stage-display window (previously
 * fixed to point at the stage server instead of a nonexistent dist path).
 *
 * 'electron' has no real implementation outside an Electron process. Vitest's
 * vi.mock/vi.doMock do NOT intercept a plain `require('electron')` call made
 * from a CommonJS file like main.js (confirmed by direct repro — mocking
 * only hooks the ESM import graph, not require() of external packages), so
 * this patches Node's Module._load directly, which works regardless of
 * vitest's own mocking layer.
 */

let origLoad
let ipcHandlers
let ipcListeners
let createdWindows
let displays

function makeFakeBrowserWindow(opts) {
  const win = {
    opts,
    webContents: {
      sent: [],
      send(channel, payload) {
        this.sent.push([channel, payload])
      },
      _finishLoadCbs: [],
      on(evt, cb) {
        if (evt === 'did-finish-load') this._finishLoadCbs.push(cb)
      },
      fireFinishLoad() {
        this._finishLoadCbs.forEach((cb) => cb())
      }
    },
    _closeCbs: [],
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    setMenuBarVisibility: vi.fn(),
    on(evt, cb) {
      if (evt === 'closed') this._closeCbs.push(cb)
    },
    close: vi.fn(function () {
      this._closeCbs.forEach((cb) => cb())
    })
  }
  createdWindows.push(win)
  return win
}

function fakeElectron() {
  return {
    app: {
      whenReady: () => Promise.resolve(),
      getPath: () => '/fake/userData',
      on: vi.fn(),
      quit: vi.fn()
    },
    BrowserWindow: Object.assign(vi.fn().mockImplementation(makeFakeBrowserWindow), {
      getAllWindows: () => createdWindows
    }),
    ipcMain: {
      handle: (channel, fn) => ipcHandlers.set(channel, fn),
      on: (channel, fn) => ipcListeners.set(channel, fn)
    },
    dialog: { showOpenDialog: vi.fn() },
    screen: {
      getAllDisplays: () => displays,
      getPrimaryDisplay: () => displays[0]
    }
  }
}

beforeEach(() => {
  ipcHandlers = new Map()
  ipcListeners = new Map()
  createdWindows = []
  displays = [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }] // single monitor by default

  origLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return fakeElectron()
    if (request === './pptx-parser') return { parsePptx: vi.fn() }
    if (request === './server') return { startServer: vi.fn(() => ({ broadcastSlide: vi.fn() })) }
    return origLoad.call(this, request, parent, isMain)
  }
})

afterEach(() => {
  Module._load = origLoad
})

async function loadMain() {
  // main.js registers its IPC handlers at load time via app.whenReady().then(...);
  // resetModules gives each test a fresh instance so handlers don't double-register
  vi.resetModules()
  await import('./main.js')
  // Let the whenReady().then(...) callback's microtasks flush
  await Promise.resolve()
  await Promise.resolve()
}

describe('toggle-audience-output', () => {
  it('opens a window on first call and returns true', async () => {
    await loadMain()
    const result = await ipcHandlers.get('toggle-audience-output')()
    expect(result).toBe(true)
    expect(createdWindows.at(-1).loadFile).toHaveBeenCalled()
  })

  it('closes the window and returns false on the second call (toggle)', async () => {
    await loadMain()
    const toggle = ipcHandlers.get('toggle-audience-output')
    await toggle()
    const win = createdWindows.at(-1)
    const result = await toggle()
    expect(result).toBe(false)
    expect(win.close).toHaveBeenCalled()
  })

  it('opens fullscreen/frameless on the external display when one exists', async () => {
    displays = [
      { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      { id: 2, bounds: { x: 1920, y: 0, width: 1280, height: 720 } }
    ]
    await loadMain()
    await ipcHandlers.get('toggle-audience-output')()
    const opts = createdWindows.at(-1).opts
    expect(opts.fullscreen).toBe(true)
    expect(opts.frame).toBe(false)
    expect(opts.width).toBe(1280)
    expect(opts.x).toBe(1920 + 40)
  })

  it('opens a small framed window on a single-monitor setup', async () => {
    await loadMain() // default: one display
    await ipcHandlers.get('toggle-audience-output')()
    const opts = createdWindows.at(-1).opts
    expect(opts.fullscreen).toBe(false)
    expect(opts.frame).toBe(true)
    expect(opts.width).toBe(960)
  })

  it('replays the last payload to a newly opened window once it finishes loading', async () => {
    await loadMain()
    ipcListeners.get('update-audience-output')({}, { slide: { text: 'replay me' } })
    await ipcHandlers.get('toggle-audience-output')()
    const win = createdWindows.at(-1)
    win.webContents.fireFinishLoad()
    expect(win.webContents.sent).toContainEqual(['audience-update', { slide: { text: 'replay me' } }])
  })
})

describe('update-audience-output', () => {
  it('forwards the payload to the open audience window', async () => {
    await loadMain()
    await ipcHandlers.get('toggle-audience-output')()
    const win = createdWindows.at(-1)
    ipcListeners.get('update-audience-output')({}, { slide: { text: 'live' } })
    expect(win.webContents.sent).toContainEqual(['audience-update', { slide: { text: 'live' } }])
  })

  it('does not throw when no audience window is open', async () => {
    await loadMain()
    expect(() => ipcListeners.get('update-audience-output')({}, { slide: null })).not.toThrow()
  })
})

describe('create-stage-display (regression: was loading a nonexistent file)', () => {
  it('loads the stage server URL, not a local file', async () => {
    await loadMain()
    ipcListeners.get('create-stage-display')()
    const win = createdWindows.at(-1)
    expect(win.loadURL).toHaveBeenCalledWith('http://localhost:8080')
    expect(win.loadFile).not.toHaveBeenCalled()
  })
})
