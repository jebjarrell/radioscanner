import { contextBridge, ipcRenderer } from 'electron';

import type { ServiceKey } from '../types/services';

export type OnTheGoApi = {
  getVersion: () => Promise<string>;
  retryService: (service: ServiceKey) => Promise<boolean>;
};

const api: OnTheGoApi = {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  retryService: (service) => ipcRenderer.invoke('service:retry', service),
};

contextBridge.exposeInMainWorld('onthego', api);

declare global {
  interface Window {
    onthego: OnTheGoApi;
  }
}
