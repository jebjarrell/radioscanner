/* eslint-disable @typescript-eslint/no-var-requires */
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  retryService: (service) => ipcRenderer.invoke('service:retry', service),
};

contextBridge.exposeInMainWorld('onthego', api);
