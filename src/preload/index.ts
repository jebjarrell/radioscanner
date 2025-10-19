import { contextBridge, ipcRenderer } from 'electron';

export type OnTheGoApi = {
  getVersion: () => Promise<string>;
};

const api: OnTheGoApi = {
  getVersion: () => ipcRenderer.invoke('app:get-version')
};

contextBridge.exposeInMainWorld('onthego', api);

declare global {
  interface Window {
    onthego: OnTheGoApi;
  }
}
