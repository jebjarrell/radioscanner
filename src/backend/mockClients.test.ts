import { afterEach, describe, expect, it, vi } from 'vitest';

import { MockDump1090Client, MockKismetRidClient } from './mockClients.js';

describe('MockKismetRidClient', () => {
  it('returns three valid drones with coordinates', async () => {
    const client = new MockKismetRidClient();
    const drones = await client.fetchRemoteId();

    expect(drones.length).toBeGreaterThanOrEqual(2);
    expect(drones.length).toBeLessThanOrEqual(3);
    for (const drone of drones) {
      expect(typeof drone.droneId).toBe('string');
      expect(drone.droneId.length).toBeGreaterThan(0);
      expect(drone.droneLat).not.toBeNull();
      expect(drone.droneLon).not.toBeNull();
      expect(drone.droneLat as number).toBeGreaterThanOrEqual(-90);
      expect(drone.droneLat as number).toBeLessThanOrEqual(90);
      expect(drone.droneLon as number).toBeGreaterThanOrEqual(-180);
      expect(drone.droneLon as number).toBeLessThanOrEqual(180);
      expect(drone.manufacturer).toBeTruthy();
      expect(drone.uaType).toBe('UAV');
    }
  });

  it('replenishes drones back to the target on repeated calls', async () => {
    const client = new MockKismetRidClient();
    await client.fetchRemoteId();
    const second = await client.fetchRemoteId();
    expect(second.length).toBeGreaterThanOrEqual(2);
  });
});

describe('MockDump1090Client', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits a snapshot with aircraft when started', () => {
    vi.useFakeTimers();
    const client = new MockDump1090Client();
    const onData = vi.fn();
    client.on('data', onData);

    client.start();

    expect(onData).toHaveBeenCalledTimes(1);
    const snapshot = onData.mock.calls[0][0];
    expect(Array.isArray(snapshot.aircraft)).toBe(true);
    expect(snapshot.aircraft.length).toBeGreaterThan(0);
    expect(typeof snapshot.now).toBe('number');

    const first = snapshot.aircraft[0];
    expect(first.hex).toMatch(/^[0-9A-F]{6}$/);
    expect(typeof first.lat).toBe('number');
    expect(typeof first.lon).toBe('number');

    client.stop();
  });

  it('reports a healthy status and exposes the last snapshot', () => {
    vi.useFakeTimers();
    const client = new MockDump1090Client();
    client.start();

    expect(client.getStatus().healthy).toBe(true);
    const snapshot = client.getLastSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.aircraft.length).toBeGreaterThan(0);

    client.stop();
  });

  it('emits additional snapshots on the interval', () => {
    vi.useFakeTimers();
    const client = new MockDump1090Client();
    const onData = vi.fn();
    client.on('data', onData);
    client.start();
    vi.advanceTimersByTime(3_000);
    expect(onData.mock.calls.length).toBeGreaterThanOrEqual(3);
    client.stop();
  });

  it('clears aircraft after stop', () => {
    vi.useFakeTimers();
    const client = new MockDump1090Client();
    client.start();
    client.stop();
    expect(client.getLastSnapshot()).not.toBeNull();
  });
});
