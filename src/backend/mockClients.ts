import { setTimeout as delay } from 'node:timers/promises';

import {
  ALTITUDE_MAX_FT,
  ALTITUDE_MIN_FT,
  HEADING_MAX_DEG,
  HEADING_MIN_DEG,
  LAT_MAX,
  LAT_MIN,
  LON_MAX,
  LON_MIN,
  SPEED_MAX_KTS,
  SPEED_MIN_KTS,
} from './constants.js';
import type { Dump1090Aircraft, Dump1090Snapshot, Dump1090Status } from './dump1090Client.js';
import type { GpsFix, GpsStatus } from './gpsClient.js';
import type { KismetStatus } from './kismetClient.js';
import type { RtlTcpStatus } from './rtlTcpClient.js';
import { getManualGpsFallback } from './settings.js';
import { TypedEventEmitter } from './utils/typedEventEmitter.js';

type Dump1090Events = {
  data: (snapshot: Dump1090Snapshot) => void;
  error: (err: Error) => void;
};

type GpsEvents = {
  connected: () => void;
  disconnected: () => void;
  error: (err: Error) => void;
};

type KismetEvents = {
  status: (status: KismetStatus) => void;
  error: (err: Error) => void;
};

type RtlTcpEventMap = {
  connected: () => void;
  disconnected: () => void;
  error: (err: Error) => void;
  banner: (banner: string) => void;
};

export class MockDump1090Client extends TypedEventEmitter<Dump1090Events> {
  private timer: NodeJS.Timeout | null = null;
  private status: Dump1090Status = { healthy: true, lastUpdated: Date.now() };
  private lastSnapshot: Dump1090Snapshot | null = null;
  private readonly aircraft = new Map<string, AircraftState>();

  start(): void {
    if (this.timer) return;
    this.emitSnapshot();
    this.timer = setInterval(() => this.emitSnapshot(), 1_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.aircraft.clear();
  }

  getStatus(): Dump1090Status {
    return { ...this.status };
  }

  getLastSnapshot(): Dump1090Snapshot | null {
    if (!this.lastSnapshot) {
      return null;
    }
    return {
      now: this.lastSnapshot.now,
      aircraft: this.lastSnapshot.aircraft.map((item) => ({ ...item })),
    };
  }

  private emitSnapshot(): void {
    this.pruneAircraft();
    this.populateAircraft();
    const now = Date.now();
    const aircraft = Array.from(this.aircraft.values()).map(toDumpAircraft);
    const snapshot: Dump1090Snapshot = { now, aircraft };
    this.lastSnapshot = snapshot;
    this.status = { healthy: true, lastUpdated: now };
    this.emit('data', snapshot);
  }

  private populateAircraft(): void {
    const target = 20;
    while (this.aircraft.size < target) {
      const state = createAircraftState();
      if (!this.aircraft.has(state.hex)) {
        this.aircraft.set(state.hex, state);
      }
    }
    for (const state of this.aircraft.values()) {
      mutateAircraft(state);
    }
  }

  private pruneAircraft(): void {
    if (this.aircraft.size === 0) {
      return;
    }
    if (this.aircraft.size > 10 && Math.random() < 0.15) {
      const [hex] = this.aircraft.keys();
      this.aircraft.delete(hex);
    }
  }
}

export class MockRtlTcpClient extends TypedEventEmitter<RtlTcpEventMap> {
  private status: RtlTcpStatus = { connected: false };
  private flappingTimer: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.status.connected) {
      return;
    }
    await delay(50);
    this.status = {
      connected: true,
      banner: 'mock rtl_tcp 2.0',
      lastConnectedAt: Date.now(),
    };
    this.emit('connected');
    if (this.status.banner) {
      this.emit('banner', this.status.banner);
    }
    this.flappingTimer = setInterval(() => {
      if (Math.random() < 0.05) {
        this.status.connected = false;
        this.emit('disconnected');
        this.status.lastError = 'Mock link drop';
        this.emit('error', new Error('Mock rtl_tcp link drop'));
        void this.reconnectSoon();
      }
    }, 15_000);
  }

  async stop(): Promise<void> {
    if (this.flappingTimer) {
      clearInterval(this.flappingTimer);
      this.flappingTimer = null;
    }
    if (this.status.connected) {
      this.status.connected = false;
      this.emit('disconnected');
    }
  }

  getStatus(): RtlTcpStatus {
    return { ...this.status };
  }

  private async reconnectSoon(): Promise<void> {
    await delay(500);
    this.status.connected = true;
    this.status.lastConnectedAt = Date.now();
    this.emit('connected');
  }
}

export class MockKismetClient extends TypedEventEmitter<KismetEvents> {
  private timer: NodeJS.Timeout | null = null;
  private status: KismetStatus = { available: true, ridEnabled: true, lastChecked: Date.now() };

  start(): void {
    if (this.timer) return;
    this.emit('status', { ...this.status });
    this.timer = setInterval(() => {
      this.status = {
        available: true,
        ridEnabled: Math.random() > 0.15,
        lastChecked: Date.now(),
      };
      this.emit('status', { ...this.status });
    }, 7_500);
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
}

export class MockGpsClient extends TypedEventEmitter<GpsEvents> {
  private status: GpsStatus = { connected: false, lastFix: null, lastChecked: undefined };
  private timer: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.status.connected) {
      return;
    }
    this.status.connected = true;
    this.status.lastChecked = Date.now();
    this.status.lastFix = createGpsFix();
    this.emit('connected');
    this.timer = setInterval(() => {
      this.status.lastChecked = Date.now();
      this.status.lastFix = createGpsFix();
    }, 10_000);
  }

  stop(): void {
    if (!this.status.connected) {
      return;
    }
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status.connected = false;
    this.status.lastChecked = Date.now();
    this.emit('disconnected');
  }

  getStatus(): GpsStatus {
    const status: GpsStatus = {
      connected: this.status.connected,
      lastError: this.status.lastError,
      lastChecked: this.status.lastChecked,
      lastFix: this.status.lastFix ? { ...this.status.lastFix } : null,
    };
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
}

interface AircraftState {
  hex: string;
  flight: string;
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  heading: number;
}

function createAircraftState(): AircraftState {
  return {
    hex: randomHex(),
    flight: randomCallsign(),
    lat: randomInRange(37.0, 39.0),
    lon: randomInRange(-123.5, -121.0),
    alt: randomInRange(2_000, 32_000),
    speed: randomInRange(180, 520),
    heading: randomInRange(0, 359),
  };
}

function mutateAircraft(state: AircraftState): void {
  state.lat = clamp(state.lat + randomInRange(-0.08, 0.08), LAT_MIN, LAT_MAX);
  state.lon = clamp(state.lon + randomInRange(-0.08, 0.08), LON_MIN, LON_MAX);
  state.alt = clamp(state.alt + randomInRange(-600, 600), ALTITUDE_MIN_FT, ALTITUDE_MAX_FT);
  state.speed = clamp(state.speed + randomInRange(-25, 25), SPEED_MIN_KTS, SPEED_MAX_KTS);
  const heading = (state.heading + randomInRange(-12, 12) + 360) % 360;
  state.heading = clamp(Math.round(heading), HEADING_MIN_DEG, HEADING_MAX_DEG);
}

function toDumpAircraft(state: AircraftState): Dump1090Aircraft {
  return {
    hex: state.hex,
    flight: state.flight,
    lat: Number(state.lat.toFixed(4)),
    lon: Number(state.lon.toFixed(4)),
    alt_baro: Math.round(state.alt),
    gs: Number(state.speed.toFixed(0)),
    heading: state.heading,
    seen: Number((Math.random() * 1.5).toFixed(1)),
  };
}

function createGpsFix(): GpsFix {
  const lat = randomInRange(37.75, 38.0);
  const lon = randomInRange(-122.6, -122.2);
  const alt = randomInRange(5, 45);
  return {
    lat: clamp(lat, LAT_MIN, LAT_MAX),
    lon: clamp(lon, LON_MIN, LON_MAX),
    alt,
    timestamp: Date.now(),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randomHex(): string {
  return Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
    .toUpperCase();
}

function randomCallsign(): string {
  const prefixes = ['N', 'DAL', 'UAL', 'SW', 'ASA', 'JBU', 'FFT', 'AAL'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}${suffix}`;
}

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
