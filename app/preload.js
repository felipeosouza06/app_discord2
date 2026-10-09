const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  getSources: () => ipcRenderer.invoke('get-sources'),
  selectSource: (id, audio) => ipcRenderer.invoke('select-source', id, audio),
  setShortcuts: (shortcuts) => ipcRenderer.invoke('set-shortcuts', shortcuts),
  onShortcut: (callback) => ipcRenderer.on('shortcut', (_event, action) => callback(action)),
  flash: () => ipcRenderer.invoke('flash'),
  appVersion: () => ipcRenderer.invoke('app-version'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateReady: (callback) => ipcRenderer.on('update-ready', (_event, version) => callback(version)),
});
