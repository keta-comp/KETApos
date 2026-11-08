const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadDb: () => ipcRenderer.invoke('db:load'),
  saveDb: (bytes) => ipcRenderer.invoke('db:save', bytes),
  getWasm: () => ipcRenderer.invoke('wasm:get'),
  printReceipt: (html) => ipcRenderer.invoke('receipt:print', html),
  getVersion: () => ipcRenderer.invoke('app:version'),
});