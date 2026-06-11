import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fromWs } from './adapters';

const NOW = 1_700_000_000_000;

describe('fromWs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps a full payload', () => {
    const result = fromWs({
      droneId: 'DRONE-1',
      manufacturer: 'DJI',
      model: 'Mavic',
      droneLat: 40.1,
      droneLon: -73.2,
      droneAltitude: 120,
      operatorLat: 40.2,
      operatorLon: -73.3,
      speed: 12,
      heading: 90,
      uaType: 'quad',
      lastSeen: 12345,
    });

    expect(result).toEqual({
      droneId: 'DRONE-1',
      manufacturer: 'DJI',
      model: 'Mavic',
      droneLat: 40.1,
      droneLon: -73.2,
      droneAltitude: 120,
      operatorLat: 40.2,
      operatorLon: -73.3,
      speed: 12,
      heading: 90,
      uaType: 'quad',
      lastSeen: 12345,
    });
  });

  it('defaults to "unknown" droneId for null/undefined entry', () => {
    expect(fromWs(null).droneId).toBe('unknown');
    expect(fromWs(undefined).droneId).toBe('unknown');
    expect(fromWs({}).droneId).toBe('unknown');
  });

  it('stringifies a non-string droneId', () => {
    expect(fromWs({ droneId: 42 as unknown as string }).droneId).toBe('42');
  });

  it('nulls out missing or non-finite numeric fields', () => {
    const result = fromWs({
      droneId: 'x',
      droneLat: Number.NaN,
      droneLon: Number.POSITIVE_INFINITY,
      droneAltitude: undefined,
      speed: null,
    });
    expect(result.droneLat).toBeNull();
    expect(result.droneLon).toBeNull();
    expect(result.droneAltitude).toBeNull();
    expect(result.speed).toBeNull();
    expect(result.heading).toBeNull();
  });

  it('nulls non-string manufacturer/model/uaType', () => {
    const result = fromWs({ droneId: 'x', manufacturer: null, model: null, uaType: null });
    expect(result.manufacturer).toBeNull();
    expect(result.model).toBeNull();
    expect(result.uaType).toBeNull();
  });

  it('defaults lastSeen to now when missing or non-finite', () => {
    expect(fromWs({ droneId: 'x' }).lastSeen).toBe(NOW);
    expect(fromWs({ droneId: 'x', lastSeen: Number.NaN }).lastSeen).toBe(NOW);
  });
});
