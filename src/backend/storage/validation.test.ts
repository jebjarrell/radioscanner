import { describe, expect, it } from 'vitest';

import {
  clamp,
  validateAircraft,
  validateDrone,
  validateSignal,
  type AircraftRecord,
  type DroneRecord,
  type SignalRecord,
} from './validation.js';

const baseAircraft = (): AircraftRecord => ({
  ts: 1_700_000_000_000,
  icao: 'a1b2c3',
  callsign: 'TEST123',
  lat: 40,
  lon: -73,
  altitude: 10_000,
  speed: 400,
  heading: 90,
  verticalRate: 100,
  squawk: '1200',
});

const baseDrone = (): DroneRecord => ({
  ts: 1_700_000_000_000,
  droneId: 'DRONE-1',
  manufacturer: 'DJI',
  model: 'Mavic',
  droneLat: 37.5,
  droneLon: -122.4,
  droneAltitude: 100,
  operatorLat: 37.5,
  operatorLon: -122.4,
  speed: 10,
  heading: 45,
});

const baseSignal = (): SignalRecord => ({
  ts: 1_700_000_000_000,
  frequency: 121.5,
  signalStrength: -50,
  bandwidth: 25_000,
  deviceLat: 37.5,
  deviceLon: -122.4,
});

describe('clamp', () => {
  it('returns the value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to the minimum and maximum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('handles equal bounds', () => {
    expect(clamp(99, 3, 3)).toBe(3);
  });
});

describe('validateAircraft', () => {
  it('accepts and rounds a valid record', () => {
    const result = validateAircraft({ ...baseAircraft(), altitude: 10_000.7, speed: 400.4 });
    expect(result).not.toBeNull();
    expect(result?.altitude).toBe(10_001);
    expect(result?.speed).toBe(400);
  });

  it('rejects an invalid ICAO', () => {
    expect(validateAircraft({ ...baseAircraft(), icao: 'ZZZ' })).toBeNull();
    expect(validateAircraft({ ...baseAircraft(), icao: '' })).toBeNull();
  });

  it('rejects non-finite coordinates', () => {
    expect(validateAircraft({ ...baseAircraft(), lat: NaN })).toBeNull();
    expect(validateAircraft({ ...baseAircraft(), lon: Infinity })).toBeNull();
  });

  it('clamps coordinates, altitude, speed and heading to range', () => {
    const result = validateAircraft({
      ...baseAircraft(),
      lat: 200,
      lon: -400,
      altitude: 200_000,
      speed: 5_000,
      heading: 500,
    });
    expect(result?.lat).toBe(90);
    expect(result?.lon).toBe(-180);
    expect(result?.altitude).toBe(60_000);
    expect(result?.speed).toBe(1_000);
    expect(result?.heading).toBe(359);
  });

  it('coerces non-finite altitude/speed/heading to 0', () => {
    const result = validateAircraft({
      ...baseAircraft(),
      altitude: NaN,
      speed: NaN,
      heading: NaN,
    });
    expect(result?.altitude).toBe(0);
    expect(result?.speed).toBe(0);
    expect(result?.heading).toBe(0);
  });

  it('preserves a null verticalRate and rounds a finite one', () => {
    expect(validateAircraft({ ...baseAircraft(), verticalRate: null })?.verticalRate).toBeNull();
    expect(validateAircraft({ ...baseAircraft(), verticalRate: 12.6 })?.verticalRate).toBe(13);
  });
});

describe('validateDrone', () => {
  it('rejects a record with no droneId', () => {
    expect(validateDrone({ ...baseDrone(), droneId: '' })).toBeNull();
  });

  it('clamps drone coordinates and altitude', () => {
    const result = validateDrone({
      ...baseDrone(),
      droneLat: 95,
      droneLon: -200,
      droneAltitude: 100_000,
    });
    expect(result?.droneLat).toBe(90);
    expect(result?.droneLon).toBe(-180);
    expect(result?.droneAltitude).toBe(60_000);
  });

  it('normalizes nulls and non-finite to null', () => {
    const result = validateDrone({
      ...baseDrone(),
      droneLat: null,
      operatorLon: Number.NaN,
      speed: null,
      heading: Number.POSITIVE_INFINITY,
    });
    expect(result?.droneLat).toBeNull();
    expect(result?.operatorLon).toBeNull();
    expect(result?.speed).toBeNull();
    expect(result?.heading).toBeNull();
  });

  it('clamps and rounds speed and heading', () => {
    const result = validateDrone({ ...baseDrone(), speed: 999.4, heading: 400.6 });
    expect(result?.speed).toBe(500);
    expect(result?.heading).toBe(359);
  });
});

describe('validateSignal', () => {
  it('rejects non-finite frequency or strength', () => {
    expect(validateSignal({ ...baseSignal(), frequency: NaN })).toBeNull();
    expect(validateSignal({ ...baseSignal(), signalStrength: Infinity })).toBeNull();
  });

  it('clamps device coordinates and preserves valid values', () => {
    const result = validateSignal({ ...baseSignal(), deviceLat: 120, deviceLon: -500 });
    expect(result?.deviceLat).toBe(90);
    expect(result?.deviceLon).toBe(-180);
    expect(result?.frequency).toBe(121.5);
  });

  it('normalizes null device coordinates', () => {
    const result = validateSignal({ ...baseSignal(), deviceLat: null, deviceLon: null });
    expect(result?.deviceLat).toBeNull();
    expect(result?.deviceLon).toBeNull();
  });
});
