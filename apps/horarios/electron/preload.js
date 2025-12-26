// Minimal preload (extend if you need secure IPC)
const { contextBridge } = require('electron')
contextBridge.exposeInMainWorld('electron', {})
