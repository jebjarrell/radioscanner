import { describe, expect, it } from 'vitest';

import {
  convertDistance,
  convertDistanceFromKm,
  formatDistance,
  formatDistanceFromKm,
  getUnitName,
  getUnitSuffix,
  toMeters,
  type DistanceUnit,
} from './distance';

describe('convertDistance', () => {
  it('converts meters to miles', () => {
    expect(convertDistance(1609.344, 'miles')).toBeCloseTo(1, 4);
  });

  it('converts meters to kilometers', () => {
    expect(convertDistance(2500, 'kilometers')).toBeCloseTo(2.5, 6);
  });

  it('converts meters to nautical miles', () => {
    expect(convertDistance(1852, 'nautical')).toBeCloseTo(1, 3);
  });
});

describe('convertDistanceFromKm', () => {
  it('converts kilometers to miles', () => {
    expect(convertDistanceFromKm(1, 'miles')).toBeCloseTo(0.621371, 5);
  });

  it('returns kilometers unchanged for the kilometers unit', () => {
    expect(convertDistanceFromKm(42, 'kilometers')).toBe(42);
  });

  it('converts kilometers to nautical miles', () => {
    expect(convertDistanceFromKm(1, 'nautical')).toBeCloseTo(0.539957, 5);
  });
});

describe('toMeters', () => {
  it('round-trips with convertDistance for each unit', () => {
    const units: DistanceUnit[] = ['miles', 'kilometers', 'nautical'];
    for (const unit of units) {
      const meters = 5000;
      const value = convertDistance(meters, unit);
      expect(toMeters(value, unit)).toBeCloseTo(meters, 2);
    }
  });
});

describe('formatDistance', () => {
  it('formats meters with default precision and suffix', () => {
    expect(formatDistance(1609.344, 'miles')).toBe('1.0 mi');
  });

  it('honours a custom precision', () => {
    expect(formatDistance(1000, 'kilometers', 3)).toBe('1.000 km');
  });
});

describe('formatDistanceFromKm', () => {
  it('formats kilometers input with the right suffix', () => {
    expect(formatDistanceFromKm(10, 'kilometers')).toBe('10.0 km');
  });

  it('converts and formats km to nautical miles', () => {
    expect(formatDistanceFromKm(1, 'nautical', 2)).toBe('0.54 nm');
  });
});

describe('getUnitSuffix', () => {
  it('returns short suffixes', () => {
    expect(getUnitSuffix('miles')).toBe('mi');
    expect(getUnitSuffix('kilometers')).toBe('km');
    expect(getUnitSuffix('nautical')).toBe('nm');
  });
});

describe('getUnitName', () => {
  it('returns human-readable names', () => {
    expect(getUnitName('miles')).toBe('Miles');
    expect(getUnitName('kilometers')).toBe('Kilometers');
    expect(getUnitName('nautical')).toBe('Nautical Miles');
  });
});
