const { ipcMain, dialog } = require('electron')
const fs = require('fs')
const path = require('path')
const { openSongDbSafe } = require('../services/songDb')

/**
 * Chart storage. The renderer sends/receives plain song objects
 * ({ id, title, category, key, chordpro, updatedAt }); this module owns the
 * SQLite file and the export/import dialogs.
 */
function registerSongsIpc({ userDataDir, getMainWindow }) {
  const { db, recoveredFrom } = openSongDbSafe(path.join(userDataDir, 'songs.db'))

  // Lets the renderer tell the user a damaged database was set aside
  ipcMain.handle('songs-recovered', () => recoveredFrom)

  ipcMain.handle('songs-list', () => db.list())
  ipcMain.handle('songs-upsert', (event, songs) => db.upsertMany(songs))
  ipcMain.handle('songs-remove', (event, ids) => db.remove(ids))
  ipcMain.handle('songs-meta-get', (event, key) => db.getMeta(key))
  ipcMain.handle('songs-meta-set', (event, key, value) => db.setMeta(key, value))

  // A standalone .db the church can copy to another machine
  ipcMain.handle('songs-export', async () => {
    const { canceled, filePath } = await dialog.showSaveDialog(getMainWindow(), {
      title: 'Export Songs Database',
      defaultPath: `easypresent-songs-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'EasyPresent Songs', extensions: ['db'] }]
    })
    if (canceled || !filePath) return false
    await fs.promises.rm(filePath, { force: true }) // VACUUM INTO needs a fresh file
    db.exportTo(filePath)
    return true
  })

  // Merges (never replaces): songs already here keep their newest edit
  ipcMain.handle('songs-import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(getMainWindow(), {
      title: 'Import Songs Database',
      filters: [{ name: 'EasyPresent Songs', extensions: ['db'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null
    return db.importFrom(filePaths[0])
  })

  return db
}

module.exports = { registerSongsIpc }
