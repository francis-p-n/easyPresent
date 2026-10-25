const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { parsePptx } = require('./pptx-parser')
const { startServer } = require('./server')

const libraryPath = () => path.join(app.getPath('userData'), 'library.json')

// Window icon for dev runs (packaged builds inherit the exe icon that
// electron-builder embeds from resources/icon.ico). Undefined when the
// generated file is absent so Electron falls back to its default.
const devIconPath = path.join(__dirname, '../resources/icon.png')
const appIcon = fs.existsSync(devIconPath) ? devIconPath : undefined

let mainWindow
let stageServer

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'EasyPresent',
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Remove menu bar for a cleaner look
  mainWindow.setMenuBarVisibility(false)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('import-pptx', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import PowerPoint Presentation',
      filters: [{ name: 'PowerPoint Files', extensions: ['pptx'] }],
      properties: ['openFile']
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    try {
      const slides = await parsePptx(filePaths[0]);
      return slides;
    } catch (error) {
      console.error('Error parsing PPTX:', error);
      throw error;
    }
  });

  // Library persistence — atomic file write (temp + rename) so a crash
  // mid-save can never corrupt the library
  const backupsDir = () => path.join(app.getPath('userData'), 'backups')
  const BACKUP_INTERVAL_MS = 10 * 60 * 1000 // snapshot at most every 10 min
  const BACKUP_KEEP = 10

  async function listBackups() {
    try {
      const names = await fs.promises.readdir(backupsDir())
      return names
        .filter((n) => /^library-\d+\.json$/.test(n))
        .sort() // timestamp in name → lexicographic == chronological
        .map((n) => path.join(backupsDir(), n))
    } catch {
      return []
    }
  }

  // Copies the current library into backups/ (rate-limited, pruned) before it
  // gets overwritten — the safety net for corruption and operator mistakes.
  async function rotateBackups() {
    const target = libraryPath()
    let stat
    try {
      stat = await fs.promises.stat(target)
    } catch {
      return // nothing to back up yet
    }
    const backups = await listBackups()
    const last = backups[backups.length - 1]
    const lastTs = last ? parseInt(path.basename(last).match(/library-(\d+)/)[1], 10) : 0
    if (stat.mtimeMs - lastTs < BACKUP_INTERVAL_MS && backups.length > 0) return

    await fs.promises.mkdir(backupsDir(), { recursive: true })
    await fs.promises.copyFile(target, path.join(backupsDir(), `library-${Date.now()}.json`))
    const all = await listBackups()
    for (const old of all.slice(0, Math.max(0, all.length - BACKUP_KEEP))) {
      await fs.promises.unlink(old).catch(() => {})
    }
  }

  ipcMain.handle('save-library', async (event, json) => {
    const target = libraryPath()
    await rotateBackups().catch((e) => console.error('Library backup failed:', e))
    const tmp = target + '.tmp'
    await fs.promises.writeFile(tmp, json, 'utf8')
    await fs.promises.rename(tmp, target)
    return true
  });

  ipcMain.handle('load-library', async () => {
    try {
      const json = await fs.promises.readFile(libraryPath(), 'utf8')
      JSON.parse(json) // validate — a torn/corrupt file must not nuke the library
      return json
    } catch (err) {
      if (err.code === 'ENOENT') return null // no file yet — renderer falls back to localStorage
      console.error('Library file unreadable, trying backups:', err.message)
      for (const backup of (await listBackups()).reverse()) {
        try {
          const json = await fs.promises.readFile(backup, 'utf8')
          JSON.parse(json)
          console.error(`Recovered library from backup: ${path.basename(backup)}`)
          return json
        } catch { /* try older backup */ }
      }
      return null
    }
  });

  // Export/import the whole library to a user-chosen .json file — the
  // operator's way to move a library between machines or keep an off-device
  // backup. Import validates before overwriting and snapshots the current
  // library first, so a bad file can't destroy anything.
  ipcMain.handle('export-library', async (event, json) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Library',
      defaultPath: `easypresent-library-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'EasyPresent Library', extensions: ['json'] }]
    })
    if (canceled || !filePath) return false
    await fs.promises.writeFile(filePath, json, 'utf8')
    return true
  });

  ipcMain.handle('import-library', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Library',
      filters: [{ name: 'EasyPresent Library', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    const json = await fs.promises.readFile(filePaths[0], 'utf8')
    const data = JSON.parse(json) // throws → renderer surfaces the error
    if (!data || typeof data !== 'object' || !Array.isArray(data.presentations)) {
      throw new Error('Not an EasyPresent library file')
    }
    // Snapshot whatever we're about to replace, ignoring the rate limit
    const target = libraryPath()
    if (fs.existsSync(target)) {
      await fs.promises.mkdir(backupsDir(), { recursive: true })
      await fs.promises.copyFile(target, path.join(backupsDir(), `library-${Date.now()}.json`))
    }
    const tmp = target + '.tmp'
    await fs.promises.writeFile(tmp, json, 'utf8')
    await fs.promises.rename(tmp, target)
    return json
  });

  // Stage server starts lazily — binding 0.0.0.0:8080 with open CORS at
  // launch is wasted startup work and needless exposure on venue Wi-Fi
  let pendingSlide = null

  function ensureStageServer() {
    if (!stageServer) {
      stageServer = startServer(8080)
      if (pendingSlide) stageServer.broadcastSlide(pendingSlide)
      if (pendingLiveState) stageServer.broadcastLiveState(pendingLiveState)
    }
    return stageServer
  }

  // Richer snapshot for the presenter / PA views (current + next slide, clock,
  // message, logo). Same lazy-start / replay-on-start rule as broadcast-slide.
  let pendingLiveState = null

  ipcMain.on('broadcast-live-state', (event, liveState) => {
    if (stageServer) {
      stageServer.broadcastLiveState(liveState)
    } else {
      pendingLiveState = liveState
    }
  })

  ipcMain.on('broadcast-slide', (event, slideData) => {
    if (stageServer) {
      stageServer.broadcastSlide(slideData);
    } else {
      pendingSlide = slideData // replayed when the server starts
    }
  });

  // ---- Audience output: the fullscreen projection window ----
  let audienceWindow = null
  let lastAudiencePayload = null

  function audienceHtmlPath() {
    // Repo runs serve from public/; packaged builds only ship dist/
    // (vite copies public/* into it)
    const dev = path.join(__dirname, '../public/output/audience.html')
    return fs.existsSync(dev) ? dev : path.join(__dirname, '../dist/output/audience.html')
  }

  // ---- Role displays ----
  // Three outputs: audience (fullscreen projection), presenter (pastor's
  // confirmation monitor) and pa (the sound/media desk). Presenter and PA are
  // local clients of the stage server, so the same pages also open on any
  // phone/laptop at http://<this-pc>:8080/presenter and /pa.
  const roleWindows = { presenter: null, pa: null }
  const ROLE_TITLES = { presenter: 'Presenter View', pa: 'PA View' }

  function displayInUse(display) {
    return [audienceWindow, roleWindows.presenter, roleWindows.pa].some(
      (w) => w && w.__displayId === display.id
    )
  }

  // Explicit choice wins; otherwise the first external display nothing else is
  // using; otherwise null (caller falls back to a window on the primary one).
  function pickDisplay(requestedId) {
    const displays = screen.getAllDisplays()
    if (requestedId != null) {
      const asked = displays.find((d) => d.id === requestedId)
      if (asked) return asked
    }
    const primary = screen.getPrimaryDisplay()
    return displays.find((d) => d.id !== primary.id && !displayInUse(d)) || null
  }

  ipcMain.handle('list-displays', () => {
    const primary = screen.getPrimaryDisplay()
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: `Display ${i + 1}${d.id === primary.id ? ' (main)' : ''} � ${d.bounds.width}�${d.bounds.height}`,
      primary: d.id === primary.id
    }))
  })

  // Windows can be closed from their own title bar, so the menu asks rather
  // than trusting its own bookkeeping
  ipcMain.handle('open-displays', () => [
    ...(audienceWindow ? ['audience'] : []),
    ...Object.keys(roleWindows).filter((r) => roleWindows[r])
  ])

  function openAudienceWindow(requestedId) {
    const primary = screen.getPrimaryDisplay()
    // Project fullscreen whenever the target isn't the operator's own screen
    const picked = pickDisplay(requestedId)
    const target = picked || primary
    const projecting = !!picked && picked.id !== primary.id

    audienceWindow = new BrowserWindow({
      x: target.bounds.x + 40,
      y: target.bounds.y + 40,
      width: projecting ? target.bounds.width : 960,
      height: projecting ? target.bounds.height : 540,
      fullscreen: projecting,
      frame: !projecting,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      title: 'Audience Output',
      icon: appIcon,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    })
    audienceWindow.__displayId = target.id

    audienceWindow.loadFile(audienceHtmlPath())
    audienceWindow.webContents.on('did-finish-load', () => {
      if (lastAudiencePayload) {
        audienceWindow.webContents.send('audience-update', lastAudiencePayload)
      }
    })
    audienceWindow.on('closed', () => {
      audienceWindow = null
    })
  }

  function openRoleWindow(role, requestedId) {
    ensureStageServer()
    const display = pickDisplay(requestedId)
    const target = display || screen.getPrimaryDisplay()
    const win = new BrowserWindow({
      x: target.bounds.x + (display ? 0 : 60),
      y: target.bounds.y + (display ? 0 : 60),
      width: display ? target.bounds.width : 1100,
      height: display ? target.bounds.height : 650,
      fullscreen: !!display,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      title: ROLE_TITLES[role],
      icon: appIcon,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    })
    win.__displayId = target.id
    win.loadURL(`http://localhost:8080/${role}/`)
    win.on('closed', () => {
      roleWindows[role] = null
    })
    roleWindows[role] = win
  }

  // Returns true when the window is now open, false when it was closed
  ipcMain.handle('toggle-display', (event, role, displayId) => {
    if (role === 'audience') {
      if (audienceWindow) {
        audienceWindow.close()
        audienceWindow = null
        return false
      }
      openAudienceWindow(displayId)
      return true
    }
    if (!(role in roleWindows)) throw new Error(`Unknown display role: ${role}`)
    if (roleWindows[role]) {
      roleWindows[role].close()
      roleWindows[role] = null
      return false
    }
    openRoleWindow(role, displayId)
    return true
  })

  // Legacy single-button entry point (kept for the existing Screens button)
  ipcMain.handle('toggle-audience-output', () => {
    if (audienceWindow) {
      audienceWindow.close()
      audienceWindow = null
      return false
    }
    openAudienceWindow()
    return true
  })

  ipcMain.on('update-audience-output', (event, payload) => {
    lastAudiencePayload = payload
    if (audienceWindow) {
      audienceWindow.webContents.send('audience-update', payload)
    }
  })

  ipcMain.on('create-stage-display', () => {
    ensureStageServer()
    const stageWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      title: 'Stage Display',
      icon: appIcon,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // The stage server already serves the full stage display (lyrics,
    // chords, transposition) from public/stage — the window is just a local
    // client of it, same as a phone or laptop on the venue Wi-Fi. The old
    // dist/src/output/stage.html path never existed in builds.
    stageWindow.loadURL('http://localhost:8080')
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
