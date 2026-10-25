// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Module from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

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
let userDataDir
let dialogMock

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
      getPath: () => userDataDir,
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
    dialog: dialogMock,
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
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easypresent-main-test-'))
  dialogMock = { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() }

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
  fs.rmSync(userDataDir, { recursive: true, force: true })
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

// ---------------------------------------------------------------------------
// Library persistence: atomic saves, rotating backups, corruption recovery
// ---------------------------------------------------------------------------

const LIB = () => path.join(userDataDir, 'library.json')
const BACKUPS = () => path.join(userDataDir, 'backups')

describe('save-library / load-library', () => {
  it('round-trips the library through the file', async () => {
    await loadMain()
    const payload = JSON.stringify({ version: 1, presentations: [{ id: 'p1' }] })
    await ipcHandlers.get('save-library')({}, payload)
    expect(fs.existsSync(LIB())).toBe(true)
    expect(await ipcHandlers.get('load-library')()).toBe(payload)
  })

  it('returns null when no library exists yet', async () => {
    await loadMain()
    expect(await ipcHandlers.get('load-library')()).toBeNull()
  })

  it('snapshots the previous library into backups/ on a later save', async () => {
    await loadMain()
    const save = ipcHandlers.get('save-library')
    await save({}, JSON.stringify({ version: 1, presentations: [] }))
    await save({}, JSON.stringify({ version: 1, presentations: [{ id: 'p2' }] }))
    const backups = fs.readdirSync(BACKUPS())
    expect(backups.length).toBe(1)
    expect(backups[0]).toMatch(/^library-\d+\.json$/)
    // The backup holds the version that was about to be overwritten
    const backedUp = JSON.parse(fs.readFileSync(path.join(BACKUPS(), backups[0]), 'utf8'))
    expect(backedUp.presentations).toEqual([])
  })

  it('recovers from the newest valid backup when the library file is corrupt', async () => {
    await loadMain()
    const good = JSON.stringify({ version: 1, presentations: [{ id: 'keep-me' }] })
    fs.mkdirSync(BACKUPS(), { recursive: true })
    fs.writeFileSync(path.join(BACKUPS(), 'library-1000.json'), '{ torn json', 'utf8')
    fs.writeFileSync(path.join(BACKUPS(), 'library-0999.json'), good, 'utf8')
    fs.writeFileSync(LIB(), '{"presentations": [{ "id": "trunc', 'utf8') // torn write
    const loaded = await ipcHandlers.get('load-library')()
    expect(JSON.parse(loaded).presentations[0].id).toBe('keep-me')
  })
})

describe('export-library / import-library', () => {
  it('writes the library JSON to the chosen path on export', async () => {
    await loadMain()
    const dest = path.join(userDataDir, 'exported.json')
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: dest })
    const payload = JSON.stringify({ version: 1, presentations: [] })
    expect(await ipcHandlers.get('export-library')({}, payload)).toBe(true)
    expect(fs.readFileSync(dest, 'utf8')).toBe(payload)
  })

  it('returns false when the export dialog is cancelled', async () => {
    await loadMain()
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true })
    expect(await ipcHandlers.get('export-library')({}, '{}')).toBe(false)
  })

  it('imports a valid library file, replacing the current library on disk', async () => {
    await loadMain()
    const src = path.join(userDataDir, 'incoming.json')
    const payload = JSON.stringify({ version: 1, presentations: [{ id: 'imported' }] })
    fs.writeFileSync(src, payload, 'utf8')
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [src] })
    expect(await ipcHandlers.get('import-library')()).toBe(payload)
    expect(fs.readFileSync(LIB(), 'utf8')).toBe(payload)
  })

  it('snapshots the existing library before an import replaces it', async () => {
    await loadMain()
    const original = JSON.stringify({ version: 1, presentations: [{ id: 'original' }] })
    await ipcHandlers.get('save-library')({}, original)
    const src = path.join(userDataDir, 'incoming.json')
    fs.writeFileSync(src, JSON.stringify({ version: 1, presentations: [] }), 'utf8')
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [src] })
    await ipcHandlers.get('import-library')()
    const backups = fs.readdirSync(BACKUPS()).map((n) =>
      JSON.parse(fs.readFileSync(path.join(BACKUPS(), n), 'utf8'))
    )
    expect(backups.some((b) => b.presentations?.[0]?.id === 'original')).toBe(true)
  })

  it('rejects a JSON file that is not an EasyPresent library', async () => {
    await loadMain()
    const src = path.join(userDataDir, 'not-a-library.json')
    fs.writeFileSync(src, JSON.stringify({ some: 'other data' }), 'utf8')
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [src] })
    await expect(ipcHandlers.get('import-library')()).rejects.toThrow(/not an easypresent library/i)
    expect(fs.existsSync(LIB())).toBe(false) // nothing was overwritten
  })

  it('returns null when the import dialog is cancelled', async () => {
    await loadMain()
    dialogMock.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    expect(await ipcHandlers.get('import-library')()).toBeNull()
  })
})

describe('toggle-display — audience / presenter / PA roles', () => {
  const threeDisplays = () => [
    { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 2, bounds: { x: 1920, y: 0, width: 1280, height: 720 } },
    { id: 3, bounds: { x: 3200, y: 0, width: 1024, height: 768 } }
  ]

  it('gives each role its own external display (no two outputs on one screen)', async () => {
    displays = threeDisplays()
    await loadMain()
    const toggle = ipcHandlers.get('toggle-display')
    await toggle(null, 'audience')
    await toggle(null, 'presenter')
    const [aud, pres] = createdWindows.slice(-2)
    expect(aud.opts.x).toBe(1920 + 40)
    expect(pres.opts.x).toBe(3200)
    expect(pres.opts.fullscreen).toBe(true)
  })

  it('falls back to a window on the primary display when no external is free', async () => {
    await loadMain() // one display
    await ipcHandlers.get('toggle-display')(null, 'pa')
    const opts = createdWindows.at(-1).opts
    expect(opts.fullscreen).toBe(false)
    expect(opts.width).toBe(1100)
  })

  it('honours an explicit display id', async () => {
    displays = threeDisplays()
    await loadMain()
    await ipcHandlers.get('toggle-display')(null, 'presenter', 3)
    expect(createdWindows.at(-1).opts.x).toBe(3200)
  })

  it('loads the role pages from the stage server and toggles closed', async () => {
    await loadMain()
    const toggle = ipcHandlers.get('toggle-display')
    expect(await toggle(null, 'presenter')).toBe(true)
    const win = createdWindows.at(-1)
    expect(win.loadURL).toHaveBeenCalledWith('http://localhost:8080/presenter/')
    expect(await ipcHandlers.get('open-displays')()).toEqual(['presenter'])
    expect(await toggle(null, 'presenter')).toBe(false)
    expect(win.close).toHaveBeenCalled()
    expect(await ipcHandlers.get('open-displays')()).toEqual([])
  })

  it('rejects unknown roles', async () => {
    await loadMain()
    expect(() => ipcHandlers.get('toggle-display')(null, 'bogus')).toThrow(/Unknown display role/)
  })
})
