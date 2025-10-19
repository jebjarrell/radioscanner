import type { ServiceKey } from '../types/services';

export interface OnTheGoApi {
  getVersion: () => Promise<string>;
  retryService: (service: ServiceKey) => Promise<boolean>;
}

declare global {
  interface Window {
    onthego: OnTheGoApi;
  }
}

export {};
