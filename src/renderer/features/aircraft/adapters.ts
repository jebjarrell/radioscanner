import type { TelemetryAircraft } from '../../types';
import type { Aircraft } from './types';

export function fromTelemetry(entry: TelemetryAircraft, now: number): Aircraft | null {
  if (typeof entry.lat !== 'number' || typeof entry.lon !== 'number') {
    return null;
  }

  return {
    icao: entry.hex.toUpperCase(),
    callsign: entry.flight?.trim() || entry.hex.toUpperCase(),
    lat: entry.lat,
    lon: entry.lon,
    altitude: typeof entry.alt_baro === 'number' ? entry.alt_baro : 0,
    speed: typeof entry.gs === 'number' ? Math.round(entry.gs) : 0,
    heading: typeof entry.track === 'number' ? Math.round(entry.track) : 0,
    verticalRate:
      typeof entry.baro_rate === 'number'
        ? Math.round(entry.baro_rate)
        : typeof entry.vert_rate === 'number'
          ? Math.round(entry.vert_rate)
          : null,
    squawk: typeof entry.squawk === 'string' ? entry.squawk : null,
    lastSeen: typeof entry.seen === 'number' ? now - Math.max(entry.seen, 0) * 1_000 : now,
  };
}
