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
    }
    return stageServer
  }

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

  ipcMain.handle('toggle-audience-output', () => {
    if (audienceWindow) {
      audienceWindow.close()
      audienceWindow = null
      return false
    }

    // Project to the external display when one exists (ProPresenter's
    // operator-screen/output-screen split); otherwise a window on the
    // primary display so single-monitor setups can still see the output
    const displays = screen.getAllDisplays()
    const primary = screen.getPrimaryDisplay()
    const external = displays.find((d) => d.id !== primary.id)

    audienceWindow = new BrowserWindow({
      x: (external || primary).bounds.x + 40,
      y: (external || primary).bounds.y + 40,
      width: external ? external.bounds.width : 960,
      height: external ? external.bounds.height : 540,
      fullscreen: !!external,
      frame: !external,
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

    audienceWindow.loadFile(audienceHtmlPath())
    audienceWindow.webContents.on('did-finish-load', () => {
      if (lastAudiencePayload) {
        audienceWindow.webContents.send('audience-update', lastAudiencePayload)
      }
    })
    audienceWindow.on('closed', () => {
      audienceWindow = null
    })
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
