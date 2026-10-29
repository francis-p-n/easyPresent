const { app, BrowserWindow } = require('electron')
const path = require('path')
const { createMainWindow } = require('./windows/mainWindow')
const { createDisplayManager } = require('./windows/displays')
const { createStageHub } = require('./services/stageHub')
const { createApiKeyStore } = require('./services/apiKey')
const { registerLibraryIpc } = require('./ipc/library')
const { registerPptxIpc } = require('./ipc/pptx')
const { registerSongsIpc } = require('./ipc/songs')
const { registerBibleIpc } = require('./ipc/bible')
const { registerDisplayIpc } = require('./ipc/displays')

// An installed app keeps its library in its own "EasyPresent" folder. Running from the source folder
// (development) keeps the folder named after the package, so an install never shares data with it.
// An explicit --user-data-dir (tests, a second instance) is respected.
if (app.isPackaged && !app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', path.join(app.getPath('appData'), 'EasyPresent'))
}

let mainWindow = null
const getMainWindow = () => mainWindow

app.whenReady().then(() => {
  const userDataDir = app.getPath('userData')
  const apiKeys = createApiKeyStore(userDataDir)
  const stageHub = createStageHub({ getApiKey: () => apiKeys.get(), regenerateApiKey: () => apiKeys.regenerate() })
  const displays = createDisplayManager({ stageHub, getMainWindow })

  registerLibraryIpc({ userDataDir, getMainWindow })
  registerPptxIpc({ getMainWindow })
  const songDb = registerSongsIpc({ userDataDir, getMainWindow })
  registerBibleIpc({ userDataDir, getMainWindow })
  registerDisplayIpc({ displays, stageHub, getMainWindow })

  mainWindow = createMainWindow()

  app.on('will-quit', () => songDb.close())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
