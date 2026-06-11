import { describe, expect, it } from 'vitest';

import { haversineDistance } from './geo';

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(40.73, -73.93, 40.73, -73.93)).toBe(0);
  });

  it('is symmetric', () => {
    const a = haversineDistance(40.73, -73.93, 34.05, -118.24);
    const b = haversineDistance(34.05, -118.24, 40.73, -73.93);
    expect(a).toBeCloseTo(b, 9);
  });

  it('computes the NYC to LA great-circle distance (~3936 km)', () => {
    const km = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(km).toBeGreaterThan(3900);
    expect(km).toBeLessThan(3980);
  });

  it('computes roughly 111 km per degree of latitude near the equator', () => {
    const km = haversineDistance(0, 0, 1, 0);
    expect(km).toBeCloseTo(111.19, 1);
  });
});
