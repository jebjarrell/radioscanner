import { describe, expect, it } from 'vitest';

import type { TelemetryAircraft } from '../../types';

import { fromTelemetry } from './adapters';

const NOW = 1_700_000_000_000;

describe('fromTelemetry', () => {
  it('returns null when lat or lon is missing', () => {
    expect(fromTelemetry({ hex: 'abc123', lon: -73 }, NOW)).toBeNull();
    expect(fromTelemetry({ hex: 'abc123', lat: 40 }, NOW)).toBeNull();
    expect(fromTelemetry({ hex: 'abc123' }, NOW)).toBeNull();
  });

  it('maps a full telemetry payload to a view model', () => {
    const entry: TelemetryAircraft = {
      hex: 'a1b2c3',
      flight: ' UAL123 ',
      lat: 40.7,
      lon: -73.9,
      alt_baro: 35000,
      gs: 451.6,
      track: 270.4,
      baro_rate: 1024.9,
      squawk: '1200',
      seen: 5,
    };

    const result = fromTelemetry(entry, NOW);

    expect(result).toEqual({
      icao: 'A1B2C3',
      callsign: 'UAL123',
      lat: 40.7,
      lon: -73.9,
      altitude: 35000,
      speed: 452,
      heading: 270,
      verticalRate: 1025,
      squawk: '1200',
      lastSeen: NOW - 5_000,
    });
  });

  it('uppercases the hex and uses it as callsign when flight is blank', () => {
    const result = fromTelemetry({ hex: 'deadbe', flight: '   ', lat: 1, lon: 2 }, NOW);
    expect(result?.icao).toBe('DEADBE');
    expect(result?.callsign).toBe('DEADBE');
  });

  it('defaults numeric fields to 0 and squawk/verticalRate to null/0 when absent', () => {
    const result = fromTelemetry({ hex: 'abcdef', lat: 1, lon: 2 }, NOW);
    expect(result?.altitude).toBe(0);
    expect(result?.speed).toBe(0);
    expect(result?.heading).toBe(0);
    expect(result?.verticalRate).toBeNull();
    expect(result?.squawk).toBeNull();
    expect(result?.lastSeen).toBe(NOW);
  });

  it('falls back to vert_rate when baro_rate is missing', () => {
    const result = fromTelemetry({ hex: 'abcdef', lat: 1, lon: 2, vert_rate: -512 }, NOW);
    expect(result?.verticalRate).toBe(-512);
  });

  it('clamps negative seen values to 0 when computing lastSeen', () => {
    const result = fromTelemetry({ hex: 'abcdef', lat: 1, lon: 2, seen: -10 }, NOW);
    expect(result?.lastSeen).toBe(NOW);
  });
});
