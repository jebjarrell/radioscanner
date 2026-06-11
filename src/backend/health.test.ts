import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HealthMonitor } from './health.js';

describe('HealthMonitor (mock mode)', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor({ useMockData: true, disableWebSocket: true });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('getSnapshot returns a fully shaped telemetry frame', async () => {
    await monitor.start();
    const frame = await monitor.getSnapshot();

    expect(typeof frame.timestamp).toBe('string');
    expect(frame.health).toMatchObject({
      rtlTcp: expect.any(Object),
      dump1090: expect.any(Object),
      kismet: expect.any(Object),
      gps: expect.any(Object),
    });
    expect(typeof frame.health.timestamp).toBe('number');
    expect(Array.isArray(frame.aircraft)).toBe(true);
    expect(frame.drone).toMatchObject({
      ridAvailable: expect.any(Boolean),
      detections: expect.any(Array),
    });
    expect(frame.signals).toMatchObject({
      rtlTcpConnected: expect.any(Boolean),
      gpsConnected: expect.any(Boolean),
    });
  });

  it('reports mock aircraft and drone detections after start', async () => {
    await monitor.start();
    const frame = await monitor.getSnapshot();

    expect(frame.aircraft.length).toBeGreaterThan(0);
    expect(frame.drone.detections.length).toBeGreaterThan(0);
    // Detections are deduplicated by droneId.
    const ids = frame.drone.detections.map((d) => d.droneId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks rtl_tcp and gps connected in mock mode', async () => {
    await monitor.start();
    const frame = await monitor.getSnapshot();
    expect(frame.signals.rtlTcpConnected).toBe(true);
    expect(frame.signals.gpsConnected).toBe(true);
  });

  it('retry returns true for a valid service name', async () => {
    await monitor.start();
    await expect(monitor.retry('dump1090')).resolves.toBe(true);
    await expect(monitor.retry('rtlTcp')).resolves.toBe(true);
    await expect(monitor.retry('kismet')).resolves.toBe(true);
    await expect(monitor.retry('gps')).resolves.toBe(true);
  });

  it('retry returns false for unknown or empty service names', async () => {
    await monitor.start();
    await expect(monitor.retry('nonsense')).resolves.toBe(false);
    await expect(monitor.retry('')).resolves.toBe(false);
  });

  it('emits health frames on the telemetry interval', async () => {
    await monitor.start();
    const frame = await new Promise<unknown>((resolve) => {
      monitor.on('health', (f) => resolve(f));
    });
    expect(frame).toBeDefined();
  }, 5_000);

  it('exposes a gps position helper', async () => {
    await monitor.start();
    const position = monitor.getGpsPosition();
    expect(position).toMatchObject({
      fix: expect.any(Boolean),
      timestamp: expect.any(Number),
    });
  });
});
