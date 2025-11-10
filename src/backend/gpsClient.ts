import net from 'node:net';

import { GPSD_CONFIG } from '../config/index.js';

import { LAT_MAX, LAT_MIN, LON_MAX, LON_MIN } from './constants.js';
import { getManualGpsFallback } from './settings.js';
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

  constructor(
    private readonly host = GPSD_CONFIG.host,
    private readonly port = GPSD_CONFIG.port,
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({ host: this.host, port: this.port }, () => {
        this.socket = socket;
        this.status.connected = true;
        this.status.lastChecked = Date.now();
        socket.write('?WATCH={"enable":false}\n');
        this.emit('connected');
        resolve();
      });

      const handleError = (err: Error) => {
        this.status.connected = false;
        this.status.lastError = err.message;
        this.status.lastChecked = Date.now();
        this.emit('error', err);
        socket.destroy();
        reject(err);
      };

      socket.once('error', handleError);
      socket.once('close', () => {
        this.status.connected = false;
        this.emit('disconnected');
        if (this.socket === socket) {
          this.socket = null;
        }
      });
    });
  }

  stop(): void {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
