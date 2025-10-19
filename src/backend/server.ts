import process from 'node:process';

import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';

import { HealthMonitor, TelemetryFrame } from './health.js';

const BACKEND_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const BROADCAST_MS = 1_000;
const MAX_ALTITUDE_FT = 60_000;
const MAX_SPEED_KTS = 1_000;
const ICAO_REGEX = /^[a-f0-9]{6}$/i;

const ScanStartSchema = z.object({
  band: z.string().min(1),
  centerHz: z.number().int().positive().optional(),
  sampleRate: z.number().int().positive().optional(),
});

const ExportSchema = z.object({
  table: z.string().min(1),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
});

const RetrySchema = z.object({
  service: z.string().min(1),
});

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHeading(value: number): number {
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  return clamp(normalized, 0, 359);
}

function sanitizeAircraft(entry: TelemetryFrame['aircraft'][number]) {
  const hex = entry.hex?.trim();
  if (!hex || !ICAO_REGEX.test(hex)) {
    return null;
  }

  const result: Record<string, unknown> = { hex };

  if (typeof entry.flight === 'string' && entry.flight.trim().length > 0) {
    result.flight = entry.flight.trim();
  }

  if (typeof entry.lat === 'number' && Number.isFinite(entry.lat)) {
    result.lat = clamp(entry.lat, -90, 90);
  }
  if (typeof entry.lon === 'number' && Number.isFinite(entry.lon)) {
    result.lon = clamp(entry.lon, -180, 180);
  }

  const altitude = typeof entry.alt_baro === 'number' ? entry.alt_baro : undefined;
  if (typeof altitude === 'number' && Number.isFinite(altitude)) {
    result.altitude = clamp(Math.round(altitude), 0, MAX_ALTITUDE_FT);
  }

  const record = entry as Record<string, unknown>;
  const groundSpeed =
    typeof record.gs === 'number'
      ? (record.gs as number)
      : typeof record.speed === 'number'
        ? (record.speed as number)
        : undefined;
  if (typeof groundSpeed === 'number' && Number.isFinite(groundSpeed)) {
    result.speed = clamp(Math.round(groundSpeed), 0, MAX_SPEED_KTS);
  }

  const heading =
    typeof record.track === 'number'
      ? (record.track as number)
      : typeof record.heading === 'number'
        ? (record.heading as number)
        : undefined;
  if (typeof heading === 'number' && Number.isFinite(heading)) {
    result.heading = normalizeHeading(heading);
  }

  if (typeof entry.seen === 'number' && Number.isFinite(entry.seen)) {
    result.lastSeen = Math.max(0, entry.seen);
  }

  return result;
}

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false });

  await server.register(cors, {
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (
        origin.startsWith('http://127.0.0.1') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('https://127.0.0.1')
      ) {
        cb(null, true);
        return;
      }
      cb(new Error('Origin not allowed by CORS'), false);
    },
  });

  await server.register(websocket);

  const healthMonitor = new HealthMonitor({
    useMockData: parseBooleanEnv(process.env.USE_MOCK_DATA),
    disableWebSocket: true,
  });

  let latestFrame: TelemetryFrame = healthMonitor.getSnapshot();
  const clients = new Set<WebSocket>();
  let broadcastTimer: NodeJS.Timeout | null = null;

  healthMonitor.on('health', (frame) => {
    latestFrame = frame;
  });

  healthMonitor.on('error', (err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[backend][health-monitor]', err);
    }
  });

  await healthMonitor.start();
  latestFrame = healthMonitor.getSnapshot();

  const broadcast = () => {
    const payload = JSON.stringify(latestFrame);
    for (const client of clients) {
      if (client.readyState !== client.OPEN) {
        clients.delete(client);
        continue;
      }
      try {
        client.send(payload);
      } catch {
        try {
          clients.delete(client);
          client.terminate();
        } catch {
          // ignore termination issues
        }
      }
    }
  };

  server.get('/ws', { websocket: true }, (socket: WebSocket) => {
    clients.add(socket);
    try {
      socket.send(JSON.stringify(latestFrame));
    } catch {
      clients.delete(socket);
      socket.close();
    }
    socket.on('close', () => {
      clients.delete(socket);
    });
    socket.on('error', () => {
      clients.delete(socket);
    });
  });

  server.get('/health', async (_request, reply) => {
    const snapshot = latestFrame.health;
    reply.send({
      sdr: { ...snapshot.rtlTcp },
      gps: { ...snapshot.gps },
      adsb: { ...snapshot.dump1090 },
      kismet: { ...snapshot.kismet },
      timestamp: snapshot.timestamp,
    });
  });

  server.get('/api/aircraft', async (_request, reply) => {
    const aircraft = latestFrame.aircraft
      .map((entry) => sanitizeAircraft(entry))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry));
    reply.send({ aircraft });
  });

  server.get('/api/drones', async (_request, reply) => {
    reply.send({ drones: [] });
  });

  server.get('/api/signals', async (_request, reply) => {
    reply.send({ signals: [] });
  });

  server.post('/api/scan/start', async (request, reply) => {
    const parseResult = ScanStartSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.code(400).send({
        success: false,
        message: 'Invalid scan request payload',
        issues: parseResult.error.issues,
      });
      return;
    }
    reply.send({
      success: true,
      message: 'SDR scanning will be implemented in Phase 6',
    });
  });

  server.post('/api/scan/stop', async (_request, reply) => {
    reply.send({ success: true });
  });

  server.post('/api/export/csv', async (request, reply) => {
    const parseResult = ExportSchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.code(400).send({
        success: false,
        message: 'Invalid export request payload',
        issues: parseResult.error.issues,
      });
      return;
    }
    reply.send({
      success: false,
      message: 'CSV export will be implemented in Phase 3',
    });
  });

  server.post('/api/service/retry', async (request, reply) => {
    const parseResult = RetrySchema.safeParse(request.body);
    if (!parseResult.success) {
      reply.code(400).send({ success: false });
      return;
    }
    const success = await healthMonitor.retry(parseResult.data.service);
    reply.send({ success });
  });

  broadcastTimer = setInterval(broadcast, BROADCAST_MS);

  async function shutdown(signal?: NodeJS.Signals | string, code = 0) {
    if (broadcastTimer) {
      clearInterval(broadcastTimer);
      broadcastTimer = null;
    }
    for (const client of clients) {
      try {
        client.close();
      } catch {
        // ignore
      }
    }
    clients.clear();

    try {
      await server.close();
    } catch {
      // ignore close errors
    }

    try {
      healthMonitor.stop();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[backend] health monitor shutdown error', err);
      }
    }

    if (signal && process.env.NODE_ENV !== 'production') {
      console.info(`[backend] exiting via ${signal}`);
    }
    process.exit(code);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    console.error('[backend] uncaught exception', err);
    void shutdown('uncaughtException', 1);
  });

  const port = Number.parseInt(process.env.BACKEND_PORT ?? '', 10) || DEFAULT_PORT;

  try {
    await server.listen({ host: BACKEND_HOST, port });
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[backend] listening on http://${BACKEND_HOST}:${port}`);
    }
  } catch (err) {
    console.error('[backend] failed to start server', err);
    await shutdown('startup-error', 1);
  }

  return server;
}

void buildServer();
