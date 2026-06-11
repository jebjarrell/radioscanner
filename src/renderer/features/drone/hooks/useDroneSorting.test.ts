import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Drone } from '../types';

import { useDroneSorting } from './useDroneSorting';

const makeDrone = (overrides: Partial<Drone>): Drone => ({
  droneId: 'id',
  manufacturer: null,
  model: null,
  droneLat: null,
  droneLon: null,
  droneAltitude: null,
  operatorLat: null,
  operatorLon: null,
  speed: null,
  heading: null,
  lastSeen: 0,
  ...overrides,
});

const fixtures: Drone[] = [
  makeDrone({ droneId: 'c', manufacturer: 'Parrot', droneAltitude: 300, distance: 50 }),
  makeDrone({ droneId: 'a', manufacturer: 'Autel', droneAltitude: 100, distance: 10 }),
  makeDrone({ droneId: 'b', manufacturer: 'DJI', droneAltitude: 200, distance: 30 }),
];

describe('useDroneSorting', () => {
  it('defaults to ascending distance', () => {
    const { result } = renderHook(() => useDroneSorting(fixtures));
    expect(result.current.sortKey).toBe('distance');
    expect(result.current.sortDirection).toBe('asc');
    expect(result.current.sorted.map((d) => d.droneId)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input = [...fixtures];
    renderHook(() => useDroneSorting(input));
    expect(input.map((d) => d.droneId)).toEqual(['c', 'a', 'b']);
  });

  it('toggles direction when the active key is re-selected', () => {
    const { result } = renderHook(() => useDroneSorting(fixtures));
    act(() => result.current.toggleSort('distance'));
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.sorted.map((d) => d.droneId)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by droneId and manufacturer alphabetically', () => {
    const { result } = renderHook(() => useDroneSorting(fixtures));
    act(() => result.current.toggleSort('droneId'));
    expect(result.current.sorted.map((d) => d.droneId)).toEqual(['a', 'b', 'c']);
    act(() => result.current.toggleSort('manufacturer'));
    expect(result.current.sorted.map((d) => d.manufacturer)).toEqual(['Autel', 'DJI', 'Parrot']);
  });

  it('sorts by altitude with missing altitude treated as -1', () => {
    const withMissing = [...fixtures, makeDrone({ droneId: 'z' })];
    const { result } = renderHook(() => useDroneSorting(withMissing));
    act(() => result.current.toggleSort('altitude'));
    expect(result.current.sorted.map((d) => d.droneId)).toEqual(['z', 'a', 'b', 'c']);
  });

  it('treats missing distance as positive infinity (sorts last ascending)', () => {
    const withMissing = [...fixtures, makeDrone({ droneId: 'z' })];
    const { result } = renderHook(() => useDroneSorting(withMissing));
    expect(result.current.sorted.at(-1)?.droneId).toBe('z');
  });
});
