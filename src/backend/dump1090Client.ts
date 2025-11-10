import {
  ALTITUDE_MAX_FT,
  ALTITUDE_MIN_FT,
  HEADING_MAX_DEG,
  HEADING_MIN_DEG,
  ICAO_REGEX,
  LAT_MAX,
  LAT_MIN,
  LON_MAX,
  LON_MIN,
  SPEED_MAX_KTS,
  SPEED_MIN_KTS,
} from './constants.js';
import { TypedEventEmitter } from './utils/typedEventEmitter.js';
import { DUMP1090_CONFIG } from '../config/index.js';

const DEFAULT_URL = `${DUMP1090_CONFIG.baseUrl}/data/aircraft.json`;
const POLL_INTERVAL_MS = 1_000;
const FETCH_TIMEOUT_MS = 1_500;

export interface Dump1090Aircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number;
  seen?: number;
  [key: string]: unknown;
}

export interface Dump1090Snapshot {
  aircraft: Dump1090Aircraft[];
  now: number;
}

export interface Dump1090Status {
  healthy: boolean;
  lastError?: string;
  lastUpdated?: number;
}

type Dump1090Events = {
  data: (snapshot: Dump1090Snapshot) => void;
  error: (err: Error) => void;
};

function sanitizeAircraft(entry: Record<string, unknown>): Dump1090Aircraft | null {
  if (typeof entry.hex !== 'string') {
    return null;
  }

  const hex = entry.hex.trim();
  if (!ICAO_REGEX.test(hex)) {
    return null;
  }

  const sanitized: Dump1090Aircraft = { hex };

  if (typeof entry.flight === 'string') {
    sanitized.flight = entry.flight.trim();
  }
  if (typeof entry.lat === 'number') {
    sanitized.lat = clamp(entry.lat, LAT_MIN, LAT_MAX);
  }
  if (typeof entry.lon === 'number') {
    sanitized.lon = clamp(entry.lon, LON_MIN, LON_MAX);
  }
  if (typeof entry.alt_baro === 'number') {
    const altitude = clamp(entry.alt_baro, ALTITUDE_MIN_FT, ALTITUDE_MAX_FT);
    sanitized.alt_baro = Math.round(altitude);
  }
  if (typeof entry.seen === 'number') {
    sanitized.seen = Math.max(0, entry.seen);
  }

  if (typeof entry.gs === 'number') {
    sanitized.gs = clamp(entry.gs, SPEED_MIN_KTS, SPEED_MAX_KTS);
  } else if (typeof entry.speed === 'number') {
    sanitized.speed = clamp(entry.speed, SPEED_MIN_KTS, SPEED_MAX_KTS);
  }

  if (typeof entry.track === 'number') {
    sanitized.track = normalizeHeading(entry.track);
  } else if (typeof entry.heading === 'number') {
    sanitized.heading = normalizeHeading(entry.heading);
  }

  return sanitized;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHeading(value: number): number {
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  return clamp(normalized, HEADING_MIN_DEG, HEADING_MAX_DEG);
}

export class Dump1090Client extends TypedEventEmitter<Dump1090Events> {
  private timer: NodeJS.Timeout | null = null;
  private status: Dump1090Status = { healthy: false };
  private lastSnapshot: Dump1090Snapshot | null = null;

  constructor(private readonly url = DEFAULT_URL) {
    super();
  }

  start(): void {
    if (this.timer) return;
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus(): Dump1090Status {
    return { ...this.status };
  }

  getLastSnapshot(): Dump1090Snapshot | null {
    return this.lastSnapshot ? { ...this.lastSnapshot } : null;
  }

  private async poll(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(this.url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`dump1090 HTTP ${res.status}`);
      }

      const payload = (await res.json()) as Record<string, unknown>;
      const now = Date.now();

      if (!payload || !Array.isArray(payload.aircraft)) {
        throw new Error('dump1090 payload missing aircraft list');
      }

      const aircraft = payload.aircraft
        .map((entry) =>
          entry && typeof entry === 'object'
            ? sanitizeAircraft(entry as Record<string, unknown>)
            : null,
        )
        .filter((entry): entry is Dump1090Aircraft => Boolean(entry));

      const snapshot: Dump1090Snapshot = { aircraft, now };
      this.lastSnapshot = snapshot;
      this.status = { healthy: true, lastUpdated: now };
      this.emit('data', snapshot);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.status = { healthy: false, lastError: error.message };
      this.emit('error', error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
