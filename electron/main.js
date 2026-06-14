const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { parsePptx } = require('./pptx-parser')
const { startServer } = require('./server')

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

  // Start Stage Server
  stageServer = startServer(8080);

  ipcMain.on('broadcast-slide', (event, slideData) => {
    if (stageServer) {
      stageServer.broadcastSlide(slideData);
    }
  });

  ipcMain.on('create-stage-display', () => {
    const stageWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      title: 'Stage Display',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })
    
    // In dev, load localhost:5173/stage.html or similar, but for now we'll just load the stage HTML directly or through dev server
    // Assuming stage.html exists in project root or we can just load a specific route
    if (process.env.NODE_ENV === 'development') {
      stageWindow.loadURL('http://localhost:5173/src/output/stage.html')
    } else {
      stageWindow.loadFile(path.join(__dirname, '../dist/src/output/stage.html'))
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
