const { ipcMain, dialog } = require('electron')
const fs = require('fs')
const path = require('path')
const { createBibleStore } = require('../services/bibleStore')

/** Importing and loading Bible translations. The renderer parses; this stores. */
function registerBibleIpc({ userDataDir, getMainWindow }) {
  const store = createBibleStore(userDataDir)

  ipcMain.handle('bible-list', () => store.list())
  ipcMain.handle('bible-load', (event, id) => store.load(id))
  ipcMain.handle('bible-save', (event, translation) => store.save(translation))
  ipcMain.handle('bible-remove', (event, id) => store.remove(id))

  // The operator picks the file; the renderer parses its text
  ipcMain.handle('bible-pick-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(getMainWindow(), {
      title: 'Add a Bible translation',
      filters: [
        { name: 'Bible text, JSON or OSIS XML', extensions: ['txt', 'json', 'xml', 'osis', 'csv', 'tsv'] },
        { name: 'All files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return { filename: path.basename(filePaths[0]), text: await fs.promises.readFile(filePaths[0], 'utf8') }
  })
}

module.exports = { registerBibleIpc }
