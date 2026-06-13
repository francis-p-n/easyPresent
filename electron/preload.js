const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // We can add window opening APIs here for stage/audience screens
  // createStageDisplay: () => ipcRenderer.send('create-stage-display'),
})
