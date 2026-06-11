import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import type { TelemetryFrame } from '../types';

import { TelemetryCache } from './telemetryCache';

const makeFrame = (): TelemetryFrame =>
  ({
    timestamp: '2024-01-01T00:00:00Z',
    aircraft: [{ hex: 'abc', lat: 1, lon: 2 }],
    drone: { ridAvailable: true, detections: [] },
    signals: { rtlTcpConnected: false, gpsConnected: false },
  }) as unknown as TelemetryFrame;

describe('TelemetryCache graceful degradation (no IndexedDB)', () => {
  let warnSpy: MockInstance;
  const originalIndexedDB = (globalThis as { indexedDB?: unknown }).indexedDB;

  beforeEach(() => {
    // jsdom has no IndexedDB; force it undefined to exercise the degraded path.
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    warnSpy = vi.spyOn(console, 'warn');
    warnSpy.mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: originalIndexedDB,
    });
    warnSpy.mockRestore();
  });

  it('init() resolves and disables the cache', async () => {
    const cache = new TelemetryCache();
    await expect(cache.init()).resolves.toBeUndefined();
    expect(cache.isAvailable()).toBe(false);
  });

  it('saveFrame() resolves to a no-op', async () => {
    const cache = new TelemetryCache();
    await expect(cache.saveFrame(makeFrame())).resolves.toBeUndefined();
    expect(cache.isAvailable()).toBe(false);
  });

  it('getLastFrame() resolves to null', async () => {
    const cache = new TelemetryCache();
    await expect(cache.getLastFrame()).resolves.toBeNull();
  });

  it('getCachedAircraft() resolves to an empty array', async () => {
    const cache = new TelemetryCache();
    await expect(cache.getCachedAircraft()).resolves.toEqual([]);
  });

  it('getStats() resolves to zeroed counts', async () => {
    const cache = new TelemetryCache();
    await expect(cache.getStats()).resolves.toEqual({ frameCount: 0, aircraftCount: 0 });
  });

  it('clearCache() resolves without throwing', async () => {
    const cache = new TelemetryCache();
    await expect(cache.clearCache()).resolves.toBeUndefined();
  });

  it('close() is safe when nothing was opened', () => {
    const cache = new TelemetryCache();
    expect(() => cache.close()).not.toThrow();
  });

  it('only logs the disable warning once', async () => {
    const cache = new TelemetryCache();
    await cache.init();
    await cache.saveFrame(makeFrame());
    await cache.getLastFrame();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
