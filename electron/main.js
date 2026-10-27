const { app, BrowserWindow } = require('electron')
const { createMainWindow } = require('./windows/mainWindow')
const { createDisplayManager } = require('./windows/displays')
const { createStageHub } = require('./services/stageHub')
const { registerLibraryIpc } = require('./ipc/library')
const { registerPptxIpc } = require('./ipc/pptx')
const { registerSongsIpc } = require('./ipc/songs')
const { registerBibleIpc } = require('./ipc/bible')
const { registerDisplayIpc } = require('./ipc/displays')

let mainWindow = null
const getMainWindow = () => mainWindow

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData')
  const stageHub = createStageHub()
  const displays = createDisplayManager({ stageHub, getMainWindow })

  registerLibraryIpc({ userDataDir, getMainWindow })
  registerPptxIpc({ getMainWindow })
  const songDb = registerSongsIpc({ userDataDir, getMainWindow })
  registerBibleIpc({ userDataDir, getMainWindow })
  registerDisplayIpc({ displays, stageHub })

  mainWindow = createMainWindow()

  app.on('will-quit', () => songDb.close())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
