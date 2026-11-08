const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadDb: () => ipcRenderer.invoke('db:load'),
  saveDb: (bytes) => ipcRenderer.invoke('db:save', bytes),
  getWasm: () => ipcRenderer.invoke('wasm:get'),
  printReceipt: (html) => ipcRenderer.invoke('receipt:print', html),
  getVersion: () => ipcRenderer.invoke('app:version'),
  // Termal printer (ESC/POS) uchun chiqish kanallari.
  serialPorts: () => ipcRenderer.invoke('printer:serial-ports'),
  serialRefresh: () => ipcRenderer.invoke('printer:serial-refresh'),
  serialWrite: (options) => ipcRenderer.invoke('printer:serial-write', options),
  saveFile: (options) => ipcRenderer.invoke('printer:save-file', options),
});
