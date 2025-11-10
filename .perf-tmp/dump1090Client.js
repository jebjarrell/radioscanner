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
const DEFAULT_URL = 'http://127.0.0.1:8080/data/aircraft.json';
const POLL_INTERVAL_MS = 1_000;
const FETCH_TIMEOUT_MS = 1_500;
function sanitizeAircraft(entry) {
  if (typeof entry.hex !== 'string') {
    return null;
  }
  const hex = entry.hex.trim();
  if (!ICAO_REGEX.test(hex)) {
    return null;
  }
  const sanitized = { hex };
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
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function normalizeHeading(value) {
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  return clamp(normalized, HEADING_MIN_DEG, HEADING_MAX_DEG);
}
export class Dump1090Client extends TypedEventEmitter {
  url;
  timer = null;
  status = { healthy: false };
  lastSnapshot = null;
  constructor(url = DEFAULT_URL) {
    super();
    this.url = url;
  }
  start() {
    if (this.timer) return;
    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
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
  getLastSnapshot() {
    return this.lastSnapshot ? { ...this.lastSnapshot } : null;
  }
  async poll() {
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
      const payload = await res.json();
      const now = Date.now();
      if (!payload || !Array.isArray(payload.aircraft)) {
        throw new Error('dump1090 payload missing aircraft list');
      }
      const aircraft = payload.aircraft
        .map((entry) => (entry && typeof entry === 'object' ? sanitizeAircraft(entry) : null))
        .filter((entry) => Boolean(entry));
      const snapshot = { aircraft, now };
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
