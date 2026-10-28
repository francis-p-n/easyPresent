const { ipcMain, dialog } = require('electron')
const fs = require('fs')
const { createLibraryStore } = require('../services/libraryStore')
const { createBibleStore } = require('../services/bibleStore')

/** Library persistence plus export/import of the whole library as one .json file. */
function registerLibraryIpc({ userDataDir, getMainWindow }) {
  const store = createLibraryStore(userDataDir)
  const bibles = createBibleStore(userDataDir)

  ipcMain.handle('save-library', (event, json) => store.save(json))
  ipcMain.handle('load-library', () => store.load())
  // Set when load-library had to restore from a backup or start fresh because the file was damaged
  ipcMain.handle('library-recovery', () => store.takeRecovery())

  ipcMain.handle('export-library', async (event, json) => {
    const { canceled, filePath } = await dialog.showSaveDialog(getMainWindow(), {
      title: 'Export Library',
      defaultPath: `easypresent-library-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'EasyPresent Library', extensions: ['json'] }]
    })
    if (canceled || !filePath) return false
    // Bible translations live in their own store; carry them along so the export is the whole show
    let out = json
    try {
      const data = JSON.parse(json)
      const all = []
      for (const t of await bibles.list()) {
        const full = await bibles.load(t.id)
        if (full) all.push(full)
      }
      if (all.length) out = JSON.stringify({ ...data, bibles: all })
    } catch (err) {
      console.error('Bible translations left out of the export:', err.message)
    }
    await fs.promises.writeFile(filePath, out, 'utf8')
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
    // Restore any translations that travelled with the export, then keep the library file itself lean
    const { bibles: embedded, ...library } = data
    if (Array.isArray(embedded)) {
      for (const t of embedded) await bibles.save(t).catch((err) => console.error(`Bible ${t && t.id} not restored:`, err.message))
    }
    const libraryJson = Array.isArray(embedded) ? JSON.stringify(library) : json
    await store.replace(libraryJson)
    return libraryJson
  })
}

module.exports = { registerLibraryIpc }
