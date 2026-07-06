const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  createStageDisplay: () => ipcRenderer.send('create-stage-display'),
  importPptx: () => ipcRenderer.invoke('import-pptx'),
  broadcastSlide: (slideData) => ipcRenderer.send('broadcast-slide', slideData),
  saveLibrary: (json) => ipcRenderer.invoke('save-library', json),
  loadLibrary: () => ipcRenderer.invoke('load-library'),

  // Audience output (fullscreen projection window)
  toggleAudienceOutput: () => ipcRenderer.invoke('toggle-audience-output'),
  updateAudienceOutput: (payload) => ipcRenderer.send('update-audience-output', payload),
  // Used by the output window itself to receive state frames
  onAudienceUpdate: (cb) => ipcRenderer.on('audience-update', (_evt, state) => cb(state))
})
