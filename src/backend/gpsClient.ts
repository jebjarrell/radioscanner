import net from 'node:net';

import { GPSD_CONFIG } from '../config/index.js';

import { LAT_MAX, LAT_MIN, LON_MAX, LON_MIN } from './constants.js';
import { getManualGpsFallback } from './settings.js';
import { clamp } from './storage/validation.js';
import { BackoffController } from './utils/backoff.js';
import { TypedEventEmitter } from './utils/typedEventEmitter.js';

export interface GpsStatus {
  connected: boolean;
  lastError?: string;
  lastFix?: GpsFix | null;
  lastChecked?: number;
}

export interface GpsFix {
  lat: number;
  lon: number;
  alt?: number;
  timestamp: number;
}

type GpsEvents = {
  connected: () => void;
  disconnected: () => void;
  error: (err: Error) => void;
};

export class GpsClient extends TypedEventEmitter<GpsEvents> {
  private socket: net.Socket | null = null;
  private status: GpsStatus = { connected: false, lastFix: null };
  private readonly backoff = new BackoffController();
  private running = false;
  private reportedDown = false;

  constructor(
    private readonly host = GPSD_CONFIG.host,
    private readonly port = GPSD_CONFIG.port,
  ) {
    super();
  }

  async start(): Promise<void> {
    // Manual (re)start resets backoff so a user-triggered retry attempts
    // immediately instead of waiting out a previously grown delay.
    this.running = true;
    this.reportedDown = false;
    this.backoff.reset();
    if (!this.socket || this.socket.destroyed) {
      this.connect();
    }
  }

  private connect(): void {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    const socket = net.createConnection({ host: this.host, port: this.port }, () => {
      this.socket = socket;
      this.status.connected = true;
      this.status.lastChecked = Date.now();
      this.backoff.reset();
      this.reportedDown = false;
      socket.write('?WATCH={"enable":false}\n');
      this.emit('connected');
    });
    this.socket = socket;

    const handleDown = (err?: Error) => {
      if (this.socket !== socket) {
        return;
      }
      const wasConnected = this.status.connected;
      this.status.connected = false;
      this.status.lastChecked = Date.now();
      if (err) {
        this.status.lastError = err.message;
      }
      socket.removeAllListeners();
      socket.destroy();
      this.socket = null;

      if (wasConnected) {
        this.emit('disconnected');
      }
      // Surface the error only on the transition into the down state, not on
      // every backoff retry, so an absent gpsd doesn't spam consumers.
      if (err && !this.reportedDown) {
        this.emit('error', err);
      }
      this.scheduleReconnect();
    };

    socket.once('error', (err) => {
      handleDown(err);
    });
    socket.once('close', () => {
      handleDown();
    });
  }

  private scheduleReconnect(): void {
    if (!this.running) {
      return;
    }
    // Log a single state transition when gpsd first goes down, not on every
    // failed attempt, to keep startup-without-hardware output calm.
    if (!this.reportedDown) {
      this.reportedDown = true;
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[gpsd] connection unavailable; retrying with backoff');
      }
    }
    this.backoff.schedule(() => this.connect());
  }

  stop(): void {
    this.running = false;
    this.reportedDown = false;
    this.backoff.cancel();
    if (this.socket) {
      this.socket.destroy();
      this.socket.removeAllListeners();
      this.socket = null;
    }
    this.status.connected = false;
    this.status.lastChecked = Date.now();
  }

  getStatus(): GpsStatus {
    const status = { ...this.status };
    const manual = getManualGpsFallback();
    const hasFix =
      status.lastFix &&
      typeof status.lastFix.lat === 'number' &&
      typeof status.lastFix.lon === 'number';

    if (!hasFix && manual.enabled && manual.lat !== null && manual.lon !== null) {
      status.lastFix = {
        lat: manual.lat,
        lon: manual.lon,
        alt: undefined,
        timestamp: manual.updatedAt ?? Date.now(),
      };
    }

    return status;
  }

  setLastFix(fix: GpsFix): void {
    const lat = clamp(fix.lat, LAT_MIN, LAT_MAX);
    const lon = clamp(fix.lon, LON_MIN, LON_MAX);
    const alt = typeof fix.alt === 'number' && Number.isFinite(fix.alt) ? fix.alt : undefined;

    this.status.lastFix = {
      lat,
      lon,
      alt,
      timestamp: fix.timestamp,
    };
  }
}
