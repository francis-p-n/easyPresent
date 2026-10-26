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

  // The operator window is the app: closing it must take the audience,
  // presenter, PA and stage windows with it. Otherwise they keep the process
  // alive (a stranded, framed audience window on the projector).
  win.on('closed', () => {
    for (const other of BrowserWindow.getAllWindows()) {
      if (other !== win && !other.isDestroyed?.()) other.close()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }
  return win
}

module.exports = { createMainWindow }
