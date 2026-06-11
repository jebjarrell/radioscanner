import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Aircraft } from '../types';

import { useAircraftSorting } from './useAircraftSorting';

const makeAircraft = (overrides: Partial<Aircraft>): Aircraft => ({
  icao: 'AAA',
  callsign: 'AAA',
  lat: 0,
  lon: 0,
  altitude: 0,
  speed: 0,
  heading: 0,
  verticalRate: null,
  squawk: null,
  lastSeen: 0,
  ...overrides,
});

const fixtures: Aircraft[] = [
  makeAircraft({ icao: 'C', callsign: 'CCC', altitude: 30000, speed: 400, distance: 50 }),
  makeAircraft({ icao: 'A', callsign: 'AAA', altitude: 10000, speed: 200, distance: 10 }),
  makeAircraft({ icao: 'B', callsign: 'BBB', altitude: 20000, speed: 300, distance: 30 }),
];

describe('useAircraftSorting', () => {
  it('defaults to ascending distance', () => {
    const { result } = renderHook(() => useAircraftSorting(fixtures));
    expect(result.current.sortKey).toBe('distance');
    expect(result.current.sortDirection).toBe('asc');
    expect(result.current.sortedAircraft.map((a) => a.icao)).toEqual(['A', 'B', 'C']);
  });

  it('does not mutate the input array', () => {
    const input = [...fixtures];
    renderHook(() => useAircraftSorting(input));
    expect(input.map((a) => a.icao)).toEqual(['C', 'A', 'B']);
  });

  it('toggles direction when the active key is re-selected', () => {
    const { result } = renderHook(() => useAircraftSorting(fixtures));
    act(() => result.current.toggleSort('distance'));
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.sortedAircraft.map((a) => a.icao)).toEqual(['C', 'B', 'A']);
  });

  it('switches key and resets to ascending', () => {
    const { result } = renderHook(() => useAircraftSorting(fixtures));
    act(() => result.current.toggleSort('callsign'));
    expect(result.current.sortKey).toBe('callsign');
    expect(result.current.sortDirection).toBe('asc');
    expect(result.current.sortedAircraft.map((a) => a.callsign)).toEqual(['AAA', 'BBB', 'CCC']);
  });

  it('sorts by altitude and speed', () => {
    const { result } = renderHook(() => useAircraftSorting(fixtures));
    act(() => result.current.toggleSort('altitude'));
    expect(result.current.sortedAircraft.map((a) => a.altitude)).toEqual([10000, 20000, 30000]);
    act(() => result.current.toggleSort('speed'));
    expect(result.current.sortedAircraft.map((a) => a.speed)).toEqual([200, 300, 400]);
  });

  it('treats missing distance as positive infinity (sorts last ascending)', () => {
    const withMissing = [...fixtures, makeAircraft({ icao: 'Z', callsign: 'ZZZ' })];
    const { result } = renderHook(() => useAircraftSorting(withMissing));
    expect(result.current.sortedAircraft.at(-1)?.icao).toBe('Z');
  });
});
