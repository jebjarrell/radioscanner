import { KISMET_CONFIG } from '../config/index.js';

import { TypedEventEmitter } from './utils/typedEventEmitter.js';

const STATUS_URL = `${KISMET_CONFIG.baseUrl}/system/status.json`;
const POLL_INTERVAL_MS = 5_000;
const FETCH_TIMEOUT_MS = 2_000;

export interface KismetStatus {
  available: boolean;
  ridEnabled: boolean;
  lastChecked?: number;
  lastError?: string;
}

type KismetEvents = {
  status: (status: KismetStatus) => void;
  error: (err: Error) => void;
};

export class KismetClient extends TypedEventEmitter<KismetEvents> {
  private timer: NodeJS.Timeout | null = null;
  private status: KismetStatus = { available: false, ridEnabled: false };
  private bleFallbackHandler: ((data: Buffer) => void) | null = null;

  start(): void {
    if (this.timer) return;
    void this.check();
    this.timer = setInterval(() => {
      void this.check();
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus(): KismetStatus {
    return { ...this.status };
  }

  setBleFallback(handler: (data: Buffer) => void): void {
    this.bleFallbackHandler = handler;
  }

  // Placeholder for future raw BLE parsing hook.
  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  handleBleFrame(_data: Buffer): void {
    if (this.bleFallbackHandler) {
      this.bleFallbackHandler(_data);
      return;
    }
    // TODO: Implement raw BLE parsing to surface RID without REST API support.
  }

  private async check(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(STATUS_URL, { method: 'GET', signal: controller.signal });
      const now = Date.now();

      if (!res.ok) {
        throw new Error(`kismet HTTP ${res.status}`);
      }

      const status = { available: true, ridEnabled: true, lastChecked: now };
      this.status = status;
      this.emit('status', status);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.status = {
        available: false,
        ridEnabled: false,
        lastError: error.message,
        lastChecked: Date.now(),
      };
      this.emit('error', error);
      this.emit('status', this.status);
    } finally {
      clearTimeout(timeout);
    }
  }
}
