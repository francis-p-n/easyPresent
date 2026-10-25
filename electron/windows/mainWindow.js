const { BrowserWindow } = require('electron')
const { appIcon, preload, indexHtml } = require('../paths')

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'EasyPresent',
    icon: appIcon,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  win.setMenuBarVisibility(false) // cleaner look

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }
  return win
}

module.exports = { createMainWindow }
