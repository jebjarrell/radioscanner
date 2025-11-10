import { TypedEventEmitter } from './utils/typedEventEmitter.js';
const STATUS_URL = 'http://127.0.0.1:2501/system/status.json';
const POLL_INTERVAL_MS = 5_000;
const FETCH_TIMEOUT_MS = 2_000;
export class KismetClient extends TypedEventEmitter {
  timer = null;
  status = { available: false, ridEnabled: false };
  bleFallbackHandler = null;
  start() {
    if (this.timer) return;
    void this.check();
    this.timer = setInterval(() => {
      void this.check();
    }, POLL_INTERVAL_MS);
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  getStatus() {
    return { ...this.status };
  }
  setBleFallback(handler) {
    this.bleFallbackHandler = handler;
  }
  // Placeholder for future raw BLE parsing hook.
  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
  handleBleFrame(_data) {
    if (this.bleFallbackHandler) {
      this.bleFallbackHandler(_data);
      return;
    }
    // TODO: Implement raw BLE parsing to surface RID without REST API support.
  }
  async check() {
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
