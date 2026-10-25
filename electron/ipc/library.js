const { ipcMain, dialog } = require('electron')
const fs = require('fs')
const { createLibraryStore } = require('../services/libraryStore')

/** Library persistence plus export/import of the whole library as one .json file. */
function registerLibraryIpc({ userDataDir, getMainWindow }) {
  const store = createLibraryStore(userDataDir)

  ipcMain.handle('save-library', (event, json) => store.save(json))
  ipcMain.handle('load-library', () => store.load())

  ipcMain.handle('export-library', async (event, json) => {
    const { canceled, filePath } = await dialog.showSaveDialog(getMainWindow(), {
      title: 'Export Library',
      defaultPath: `easypresent-library-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'EasyPresent Library', extensions: ['json'] }]
    })
    if (canceled || !filePath) return false
    await fs.promises.writeFile(filePath, json, 'utf8')
    return true
  })

  // Validates before overwriting, and snapshots the current library first,
  // so a bad file can't destroy anything.
  ipcMain.handle('import-library', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(getMainWindow(), {
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
    await store.replace(json)
    return json
  })
}

module.exports = { registerLibraryIpc }
