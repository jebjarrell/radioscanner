import { describe, expect, it } from 'vitest';

import { haversineDistance } from './geo';

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('computes ~111.19 km per degree of latitude', () => {
    expect(haversineDistance(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });

  it('computes ~111.19 km per degree of longitude at the equator', () => {
    expect(haversineDistance(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });

  it('is symmetric in its endpoints', () => {
    const ab = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    const ba = haversineDistance(34.0522, -118.2437, 40.7128, -74.006);
    expect(ab).toBeCloseTo(ba, 9);
  });
});
