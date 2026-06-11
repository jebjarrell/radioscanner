import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

let server: FastifyInstance;
let tempDir: string;
let baseUrl: string;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-test-'));
  process.env.SETTINGS_DB_FILE = path.join(tempDir, 'settings.sqlite');
  process.env.SESSION_DB_FILE = ':memory:';
  process.env.USE_MOCK_DATA = '1';
  process.env.NODE_ENV = 'test';
  // Bind to an ephemeral port to avoid conflicts with port 3000.
  process.env.BACKEND_PORT = '0';

  const { buildServer } = await import('./server.js');
  server = await buildServer({ listen: true, installProcessHandlers: false });
  const address = server.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
}, 20_000);

afterAll(async () => {
  if (server) {
    await server.close();
  }
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  delete process.env.SETTINGS_DB_FILE;
  delete process.env.SESSION_DB_FILE;
  delete process.env.BACKEND_PORT;
});

describe('GET /health', () => {
  it('returns 200 with the expected health shape', async () => {
    const res = await server.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('sdr');
    expect(body).toHaveProperty('gps');
    expect(body).toHaveProperty('adsb');
    expect(body).toHaveProperty('kismet');
    expect(typeof body.timestamp).toBe('number');
  });
});

describe('GET /api/aircraft', () => {
  it('returns an aircraft array', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/aircraft' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().aircraft)).toBe(true);
  });
});

describe('GET /api/drones', () => {
  it('returns a non-empty drone list in mock mode', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/drones' });
    expect(res.statusCode).toBe(200);
    const drones = res.json().drones;
    expect(Array.isArray(drones)).toBe(true);
    expect(drones.length).toBeGreaterThan(0);
    expect(drones[0]).toHaveProperty('droneId');
  });
});

describe('GET /api/settings', () => {
  it('returns structured settings with defaults', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/settings' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.session.storageMode).toBe('memory');
    expect(body.services.backendPort).toBe(3000);
    expect(body.performance.peakDetectionSensitivity).toBe('medium');
  });
});

describe('POST /api/settings', () => {
  it('persists a valid setting and reports restart need', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/settings',
      payload: { key: 'services.kismetPort', value: '2502' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, requiresRestart: true });

    const check = await server.inject({ method: 'GET', url: '/api/settings' });
    expect(check.json().services.kismetPort).toBe(2502);
  });

  it('applies a dynamic setting without requiring restart', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/settings',
      payload: { key: 'performance.peakDetectionSensitivity', value: 'high' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, requiresRestart: false });
  });

  it('rejects an invalid payload with 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/settings',
      payload: { value: 'no-key' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ success: false });
  });
});

describe('POST /api/settings/reset', () => {
  it('resets settings to defaults', async () => {
    await server.inject({
      method: 'POST',
      url: '/api/settings',
      payload: { key: 'services.kismetPort', value: '9999' },
    });
    const res = await server.inject({
      method: 'POST',
      url: '/api/settings/reset',
      payload: { section: 'services' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, requiresRestart: true });

    const check = await server.inject({ method: 'GET', url: '/api/settings' });
    expect(check.json().services.kismetPort).toBe(2501);
  });
});

describe('GET /api/stats', () => {
  it('returns counts for aircraft, drones and signals', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/stats' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.aircraftCount).toBe('number');
    expect(typeof body.droneCount).toBe('number');
    expect(typeof body.signalCount).toBe('number');
  });
});

describe('POST /api/scan/start and /api/scan/stop', () => {
  it('returns a success boolean for a valid scan start (hardware may be absent)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/scan/start',
      payload: { centerHz: 118_000_000, sampleRate: 2_048_000 },
    });
    // Without rtl_tcp hardware the controller fails and returns 500; either way
    // the body carries a success boolean.
    expect([200, 500]).toContain(res.statusCode);
    expect(typeof res.json().success).toBe('boolean');
  });

  it('rejects an invalid scan start payload with 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/scan/start',
      payload: { centerHz: -5 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('stops scanning successfully', async () => {
    const res = await server.inject({ method: 'POST', url: '/api/scan/stop' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });
});

describe('POST /api/service/retry', () => {
  it('returns success true for a known service', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/service/retry',
      payload: { service: 'dump1090' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });

  it('returns success false for an unknown service', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/service/retry',
      payload: { service: 'totally-unknown' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: false });
  });

  it('rejects a missing service with 400', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/service/retry',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/export/csv', () => {
  it('exports the aircraft table as CSV', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/export/csv?table=aircraft' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('ICAO,Callsign');
  });

  it('returns 400 when the table parameter is missing', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/export/csv' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for an unsupported table', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/export/csv?table=nope' });
    expect(res.statusCode).toBe(400);
  });
});

describe('WebSocket /ws', () => {
  it('delivers a telemetry frame with the expected keys on connect', async () => {
    const frame = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const ws = new WebSocket(`${baseUrl.replace('http', 'ws')}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timed out waiting for telemetry frame'));
      }, 5_000);

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          // Ignore rf_spectrum control frames; we want the telemetry frame.
          if (parsed && parsed.type === 'rf_spectrum') {
            return;
          }
          clearTimeout(timeout);
          ws.close();
          resolve(parsed);
        } catch (err) {
          clearTimeout(timeout);
          ws.close();
          reject(err as Error);
        }
      });
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    expect(frame).toHaveProperty('health');
    expect(frame).toHaveProperty('aircraft');
    expect(frame).toHaveProperty('drone');
    expect(frame).toHaveProperty('signals');
  }, 10_000);
});
