//#region electron/preload.js
var { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
	createStageDisplay: () => ipcRenderer.send("create-stage-display"),
	importPptx: () => ipcRenderer.invoke("import-pptx"),
	broadcastSlide: (slideData) => ipcRenderer.send("broadcast-slide", slideData)
});
//#endregion
