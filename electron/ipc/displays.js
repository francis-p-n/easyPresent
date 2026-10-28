const { ipcMain } = require('electron')

/** Wires the renderer's screen controls and live feeds to the display windows. */
function registerDisplayIpc({ displays, stageHub, getMainWindow }) {
  // Phone remote commands go to the operator window, which owns all live state
  stageHub.setRemoteHandler?.((cmd) => {
    const win = getMainWindow && getMainWindow()
    if (win && !win.isDestroyed()) win.webContents.send('remote-command', cmd)
  })

  ipcMain.handle('list-displays', () => displays.listDisplays())
  ipcMain.handle('open-displays', () => displays.openRoles())
  ipcMain.handle('toggle-display', (event, role, displayId) => displays.toggle(role, displayId))
  // Legacy single-button entry point (kept for the existing Screens button)
  ipcMain.handle('toggle-audience-output', () => displays.toggle('audience'))

  ipcMain.on('update-audience-output', (event, payload) => displays.updateAudience(payload))
  ipcMain.on('create-stage-display', () => displays.openStageDisplay().catch((e) => console.error(e.message)))

  // "Share to phones & tablets": start the web server on request and report the
  // addresses a phone on the same Wi-Fi can open
  ipcMain.handle('stage-share-status', () => stageHub.status())
  ipcMain.handle('stage-share-start', async () => {
    await stageHub.share()
    return stageHub.status()
  })
  ipcMain.handle('stage-share-stop', async () => {
    await stageHub.unshare()
    return stageHub.status()
  })

  // Text feeds for the stage / presenter / PA web views
  ipcMain.on('broadcast-slide', (event, slide) => stageHub.broadcastSlide(slide))
  ipcMain.on('broadcast-live-state', (event, state) => stageHub.broadcastLiveState(state))
}

module.exports = { registerDisplayIpc }
