const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  createStageDisplay: () => ipcRenderer.send('create-stage-display'),
  importPptx: () => ipcRenderer.invoke('import-pptx'),
  broadcastSlide: (slideData) => ipcRenderer.send('broadcast-slide', slideData),
  saveLibrary: (json) => ipcRenderer.invoke('save-library', json),
  loadLibrary: () => ipcRenderer.invoke('load-library'),
  libraryRecovery: () => ipcRenderer.invoke('library-recovery'),
  exportLibrary: (json) => ipcRenderer.invoke('export-library', json),
  broadcastLiveState: (state) => ipcRenderer.send('broadcast-live-state', state),
  // Bible translations (imported by the church; none are bundled)
  bibleList: () => ipcRenderer.invoke('bible-list'),
  bibleLoad: (id) => ipcRenderer.invoke('bible-load', id),
  bibleSave: (translation) => ipcRenderer.invoke('bible-save', translation),
  bibleRemove: (id) => ipcRenderer.invoke('bible-remove', id),
  biblePickFile: () => ipcRenderer.invoke('bible-pick-file'),

  // Chart database (SQLite)
  songsList: () => ipcRenderer.invoke('songs-list'),
  songsRecovered: () => ipcRenderer.invoke('songs-recovered'),
  songsUpsert: (songs) => ipcRenderer.invoke('songs-upsert', songs),
  songsRemove: (ids) => ipcRenderer.invoke('songs-remove', ids),
  songsMetaGet: (key) => ipcRenderer.invoke('songs-meta-get', key),
  songsMetaSet: (key, value) => ipcRenderer.invoke('songs-meta-set', key, value),
  songsExport: () => ipcRenderer.invoke('songs-export'),
  songsImport: () => ipcRenderer.invoke('songs-import'),
  importLibrary: () => ipcRenderer.invoke('import-library'),

  // Role displays: 'audience' | 'presenter' | 'pa'
  listDisplays: () => ipcRenderer.invoke('list-displays'),
  stageShareStatus: () => ipcRenderer.invoke('stage-share-status'),
  stageShareStart: () => ipcRenderer.invoke('stage-share-start'),
  stageShareStop: () => ipcRenderer.invoke('stage-share-stop'),
  openDisplays: () => ipcRenderer.invoke('open-displays'),
  toggleDisplay: (role, displayId) => ipcRenderer.invoke('toggle-display', role, displayId),

  // Audience output (fullscreen projection window)
  toggleAudienceOutput: () => ipcRenderer.invoke('toggle-audience-output'),
  updateAudienceOutput: (payload) => ipcRenderer.send('update-audience-output', payload),
  // Used by the output window itself to receive state frames
  // Phone remote: 'next' | 'prev' | 'clear' | 'logo'
  onRemoteCommand: (cb) => ipcRenderer.on('remote-command', (_evt, cmd) => cb(cmd)),
  onAudienceUpdate: (cb) => ipcRenderer.on('audience-update', (_evt, state) => cb(state))
})
