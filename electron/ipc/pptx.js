const { ipcMain, dialog } = require('electron')
const { parsePptx } = require('../pptx/parser')

function registerPptxIpc({ getMainWindow }) {
  ipcMain.handle('import-pptx', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(getMainWindow(), {
      title: 'Import PowerPoint Presentation',
      filters: [{ name: 'PowerPoint Files', extensions: ['pptx'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return null

    try {
      return await parsePptx(filePaths[0])
    } catch (error) {
      console.error('Error parsing PPTX:', error)
      throw error
    }
  })
}

module.exports = { registerPptxIpc }
