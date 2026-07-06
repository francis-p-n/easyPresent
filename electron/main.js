const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron')
const path = require('path')
const fs = require('fs')
const { parsePptx } = require('./pptx-parser')
const { startServer } = require('./server')

const libraryPath = () => path.join(app.getPath('userData'), 'library.json')

let mainWindow
let stageServer

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'ProPresenter Clone',
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
  ipcMain.handle('save-library', async (event, json) => {
    const target = libraryPath()
    const tmp = target + '.tmp'
    await fs.promises.writeFile(tmp, json, 'utf8')
    await fs.promises.rename(tmp, target)
    return true
  });

  ipcMain.handle('load-library', async () => {
    try {
      return await fs.promises.readFile(libraryPath(), 'utf8')
    } catch {
      return null // no file yet — renderer falls back to localStorage
    }
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
