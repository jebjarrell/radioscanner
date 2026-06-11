import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KismetRidClient } from './kismetRid.js';

type FetchResult = {
  ok: boolean;
  status?: number;
  json?: () => Promise<unknown>;
};

const mockFetchOnce = (result: FetchResult): void => {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok: result.ok,
    status: result.status ?? (result.ok ? 200 : 500),
    json: result.json ?? (async () => []),
  } as unknown as Response);
};

const validDevice = (overrides: Record<string, unknown> = {}) => ({
  'kismet.device.base.key': 'key-1',
  'kismet.device.base.macaddr': 'AA:BB:CC:DD:EE:FF',
  'kismet.device.base.type': 'Wi-Fi UAV',
  'uav.manufacturer': 'DJI',
  'uav.model': 'Mavic 3',
  'uav.serialnumber': 'SN-12345',
  'kismet.device.base.location': {
    'kismet.common.location.avg_lat': 37.5,
    'kismet.common.location.avg_lon': -122.4,
    'kismet.common.location.avg_alt': 80,
  },
  'kismet.device.base.last_time': 1_700_000_000,
  ...overrides,
});

describe('KismetRidClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('maps a valid UAV device into a RemoteIdPayload', async () => {
    mockFetchOnce({ ok: true, json: async () => [validDevice()] });
    const client = new KismetRidClient('http://kismet.test');
    const result = await client.fetchRemoteId();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      droneId: 'SN-12345',
      manufacturer: 'DJI',
      model: 'Mavic 3',
      droneLat: 37.5,
      droneLon: -122.4,
      droneAltitude: 80,
      operatorLat: null,
      operatorLon: null,
      uaType: 'Wi-Fi UAV',
      lastSeen: 1_700_000_000,
    });
  });

  it('filters out devices missing both serial number and id', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => [
        validDevice({ 'uav.serialnumber': undefined, 'uav.id': undefined }),
        validDevice({ 'uav.serialnumber': undefined, 'uav.id': 'ID-9' }),
      ],
    });
    const client = new KismetRidClient('http://kismet.test');
    const result = await client.fetchRemoteId();

    expect(result).toHaveLength(1);
    expect(result[0].droneId).toBe('ID-9');
  });

  it('nulls out-of-range coordinates', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => [
        validDevice({
          'kismet.device.base.location': {
            'kismet.common.location.avg_lat': 200,
            'kismet.common.location.avg_lon': -400,
            'kismet.common.location.avg_alt': 80,
          },
        }),
      ],
    });
    const client = new KismetRidClient('http://kismet.test');
    const result = await client.fetchRemoteId();

    expect(result[0].droneLat).toBeNull();
    expect(result[0].droneLon).toBeNull();
  });

  it('falls back to manuf and now() when fields are missing', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => [
        {
          'kismet.device.base.key': 'k',
          'kismet.device.base.macaddr': '11:22:33:44:55:66',
          'kismet.device.base.manuf': 'GenericCorp',
          'uav.id': 'ID-1',
        },
      ],
    });
    const client = new KismetRidClient('http://kismet.test');
    const before = Date.now();
    const result = await client.fetchRemoteId();

    expect(result[0].droneId).toBe('ID-1');
    expect(result[0].manufacturer).toBe('GenericCorp');
    expect(result[0].model).toBeNull();
    expect(result[0].droneLat).toBeNull();
    expect(result[0].lastSeen).toBeGreaterThanOrEqual(before);
  });

  it('returns [] for a non-array response', async () => {
    mockFetchOnce({ ok: true, json: async () => ({ not: 'an array' }) });
    const client = new KismetRidClient('http://kismet.test');
    expect(await client.fetchRemoteId()).toEqual([]);
  });

  it('returns [] on a non-ok HTTP status', async () => {
    mockFetchOnce({ ok: false, status: 503 });
    const client = new KismetRidClient('http://kismet.test');
    expect(await client.fetchRemoteId()).toEqual([]);
  });

  it('returns [] when fetch rejects', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const client = new KismetRidClient('http://kismet.test');
    expect(await client.fetchRemoteId()).toEqual([]);
  });

  it('logs the down state only once across consecutive failures', async () => {
    const warnSpy = vi.mocked(console.warn);
    const client = new KismetRidClient('http://kismet.test');

    vi.mocked(global.fetch).mockRejectedValue(new Error('down'));
    await client.fetchRemoteId();
    await client.fetchRemoteId();
    await client.fetchRemoteId();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('logs again after recovering and going down a second time', async () => {
    const warnSpy = vi.mocked(console.warn);
    const client = new KismetRidClient('http://kismet.test');

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('down-1'));
    await client.fetchRemoteId();

    mockFetchOnce({ ok: true, json: async () => [validDevice()] });
    await client.fetchRemoteId();

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('down-2'));
    await client.fetchRemoteId();

    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});
