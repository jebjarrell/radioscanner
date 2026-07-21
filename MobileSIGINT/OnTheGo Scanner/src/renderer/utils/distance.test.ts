import { describe, expect, it } from 'vitest';

import {
  convertDistance,
  convertDistanceFromKm,
  formatDistance,
  getUnitName,
  getUnitSuffix,
  toMeters,
} from './distance';

describe('convertDistance', () => {
  it('converts meters to kilometers', () => {
    expect(convertDistance(1000, 'kilometers')).toBeCloseTo(1, 9);
  });

  it('converts meters to miles', () => {
    expect(convertDistance(1609.344, 'miles')).toBeCloseTo(1, 3);
  });

  it('converts meters to nautical miles', () => {
    expect(convertDistance(1852, 'nautical')).toBeCloseTo(1, 3);
  });
});

describe('toMeters', () => {
  it('is the inverse of the kilometers conversion', () => {
    expect(toMeters(1, 'kilometers')).toBeCloseTo(1000, 6);
  });

  it('round-trips meters -> miles -> meters', () => {
    const meters = 5000;
    const roundTripped = toMeters(convertDistance(meters, 'miles'), 'miles');
    expect(roundTripped).toBeCloseTo(meters, 6);
  });
});

describe('convertDistanceFromKm', () => {
  it('returns kilometers unchanged', () => {
    expect(convertDistanceFromKm(42, 'kilometers')).toBe(42);
  });

  it('converts kilometers to miles', () => {
    expect(convertDistanceFromKm(1, 'miles')).toBeCloseTo(0.621371, 6);
  });
});

describe('formatDistance', () => {
  it('formats with the unit suffix and default precision', () => {
    expect(formatDistance(1000, 'kilometers')).toBe('1.0 km');
  });

  it('honors an explicit precision', () => {
    expect(formatDistance(1000, 'kilometers', 2)).toBe('1.00 km');
  });
});

describe('unit labels', () => {
  it('returns short suffixes', () => {
    expect(getUnitSuffix('miles')).toBe('mi');
    expect(getUnitSuffix('kilometers')).toBe('km');
    expect(getUnitSuffix('nautical')).toBe('nm');
  });

  it('returns full names', () => {
    expect(getUnitName('nautical')).toBe('Nautical Miles');
  });
});
