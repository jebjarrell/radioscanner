import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';

import { BACKEND_CONFIG } from '../config/index.js';

import { HealthMonitor, TelemetryFrame } from './health.js';
import type { SpectrumFrame } from './sdr/psdEngine.js';
import { RfController } from './sdr/rfController.js';
import { parseSettings, requiresRestart } from './services/settingsParser.js';
import { AircraftDatabase } from './storage/aircraftDb.js';
import { sessionDb, settingsDb as settingsConnection } from './storage/db.js';
import { SettingsDatabase } from './storage/settingsDb.js';
import { SignalDatabase } from './storage/signalDb.js';
import { TelemetryBatcher } from './storage/telemetryBatcher.js';
import { ICAO, clamp, validateAircraft, type AircraftRecord } from './storage/validation.js';

const BACKEND_HOST = BACKEND_CONFIG.host;
const DEFAULT_PORT = 3000;
const BROADCAST_MS = 1_000;
const MAX_ALTITUDE_FT = 60_000;
const MAX_SPEED_KTS = 1_000;

type RfSpectrumPayload = SpectrumFrame & {
  peaks: Array<{ frequency: number; power: number }>;
};

const ScanStartSchema = z.object({
  band: z.string().min(1).optional(),
  centerHz: z.number().int().positive().optional(),
  sampleRate: z.number().int().positive().optional(),
  gain: z.union([z.literal('auto'), z.number().int().min(0)]).optional(),
  spanHz: z.number().int().positive().optional(),
});

const RetrySchema = z.object({
  service: z.string().min(1),
});

const SettingsSchema = z.object({
  key: z.string().min(1),
  value: z.string().optional(),
});

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeHeading(value: number): number {
  const normalized = ((Math.round(value) % 360) + 360) % 360;
  return clamp(normalized, 0, 359);
}

function sanitizeAircraft(entry: TelemetryFrame['aircraft'][number]) {
  const hex = entry.hex?.trim();
  if (!hex || !ICAO.test(hex)) {
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

function extractNumber(source: unknown, fallback = 0): number {
  if (typeof source === 'number' && Number.isFinite(source)) {
    return source;
  }
  return fallback;
}

function toAircraftRecord(
  entry: TelemetryFrame['aircraft'][number],
  timestamp: number,
): AircraftRecord | null {
  const icao = typeof entry.hex === 'string' ? entry.hex.trim().toUpperCase() : '';
  if (!icao || !ICAO.test(icao)) {
    return null;
  }

  const lat = typeof entry.lat === 'number' ? entry.lat : NaN;
  const lon = typeof entry.lon === 'number' ? entry.lon : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const recordProps = entry as Record<string, unknown>;
  const speed =
    typeof recordProps.gs === 'number'
      ? recordProps.gs
      : typeof recordProps.speed === 'number'
        ? recordProps.speed
        : 0;
  const heading =
    typeof recordProps.track === 'number'
      ? recordProps.track
      : typeof recordProps.heading === 'number'
        ? recordProps.heading
        : 0;

  let verticalRate: number | null = null;
  if (typeof recordProps.baro_rate === 'number') {
    verticalRate = recordProps.baro_rate;
  } else if (typeof recordProps.vert_rate === 'number') {
    verticalRate = recordProps.vert_rate;
  }

  const squawk =
    typeof recordProps.squawk === 'string' && recordProps.squawk.trim().length > 0
      ? recordProps.squawk.trim()
      : null;

  const callsign =
    typeof entry.flight === 'string' && entry.flight.trim().length > 0 ? entry.flight.trim() : null;

  return {
    ts: timestamp,
    icao,
    callsign,
    lat,
    lon,
    altitude: extractNumber(entry.alt_baro, 0),
    speed: extractNumber(speed, 0),
    heading: extractNumber(heading, 0),
    verticalRate: verticalRate !== null ? extractNumber(verticalRate, 0) : null,
    squawk,
  };
}

interface BuildServerOptions {
  /** When false, the server is built but server.listen() is not called. Defaults to true. */
  listen?: boolean;
  /** When false, process signal handlers and process.exit are not registered. Defaults to true. */
  installProcessHandlers?: boolean;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const shouldListen = options.listen ?? true;
  const installProcessHandlers = options.installProcessHandlers ?? true;
  const server = Fastify({ logger: false });

  await server.register(cors, {
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      const allowedHosts = [BACKEND_HOST, 'localhost'];
      if (
        allowedHosts.some(
          (host) => origin.startsWith(`http://${host}`) || origin.startsWith(`https://${host}`),
        )
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

  // Initialize with empty frame, will be populated after start
  let latestFrame: TelemetryFrame = {
    timestamp: new Date().toISOString(),
    health: {
      rtlTcp: { connected: false },
      dump1090: { healthy: false },
      kismet: { available: false, ridEnabled: false },
      gps: { connected: false },
      timestamp: Date.now(),
    },
    aircraft: [],
    drone: { ridAvailable: false, detections: [] },
    signals: { rtlTcpConnected: false, gpsConnected: false },
  };
  const clients = new Set<WebSocket>();
  let broadcastTimer: NodeJS.Timeout | null = null;
  let shuttingDown = false;
  let lastProcessedTimestamp = 0;
  let latestRfFrame: RfSpectrumPayload | null = null;

  const aircraftDb = new AircraftDatabase(sessionDb);
  const signalDb = new SignalDatabase(sessionDb);
  const settingsDb = new SettingsDatabase(settingsConnection);
  const rfController = new RfController(signalDb);
  const aircraftBatcher = new TelemetryBatcher<AircraftRecord>(
    (batch) => {
      const valid = batch
        .map((record) => validateAircraft(record))
        .filter((record): record is AircraftRecord => record !== null);
      if (valid.length) {
        aircraftDb.insertBatch(valid);
      }
    },
    100,
    5_000,
  );

  const queueAircraftFromFrame = (frame: TelemetryFrame) => {
    const frameTimestamp = frame.health?.timestamp ?? Date.now();
    if (frameTimestamp <= lastProcessedTimestamp) {
      return;
    }
    lastProcessedTimestamp = frameTimestamp;
    const processedAt = Date.now();
    for (const aircraft of frame.aircraft ?? []) {
      const record = toAircraftRecord(aircraft, processedAt);
      if (record) {
        aircraftBatcher.enqueue(record);
      }
    }
  };

  /**
   * Apply dynamic performance settings that don't require restart
   */
  const applyPerformanceSettings = (key: string, value: string): void => {
    if (key === 'performance.peakDetectionSensitivity') {
      const level = value as 'low' | 'medium' | 'high';
      if (level === 'low' || level === 'medium' || level === 'high') {
        rfController.setPeakSensitivity(level);
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[server] Applied peak sensitivity: ${level}`);
        }
      }
    }
  };

  // Initialize peak sensitivity from settings on startup
  const initializeSettings = (): void => {
    const flat = settingsDb.getAll();
    const sensitivity = flat['performance.peakDetectionSensitivity'];
    if (sensitivity === 'low' || sensitivity === 'medium' || sensitivity === 'high') {
      rfController.setPeakSensitivity(sensitivity);
    }
  };

  initializeSettings();

  healthMonitor.on('health', (frame) => {
    latestFrame = frame;
    queueAircraftFromFrame(frame);
  });

  healthMonitor.on('error', (err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[backend][health-monitor]', err);
    }
  });

  await healthMonitor.start();
  const snapshot = await healthMonitor.getSnapshot();
  latestFrame = snapshot;
  queueAircraftFromFrame(snapshot);

  const sendToClients = (payload: string) => {
    for (const client of clients) {
      if (client.readyState !== client.OPEN) {
        clients.delete(client);
        continue;
      }
      try {
        client.send(payload);
      } catch (err) {
        // Log send failures even in production
        console.error('[websocket] Failed to send to client:', err);
        try {
          clients.delete(client);
          client.terminate();
        } catch (termErr) {
          // Log termination issues
          console.error('[websocket] Failed to terminate client:', termErr);
        }
      }
    }
  };

  const broadcast = () => {
    const payload = JSON.stringify(latestFrame);
    sendToClients(payload);
  };

  const broadcastRfFrame = (frame: RfSpectrumPayload) => {
    const payload = JSON.stringify({ type: 'rf_spectrum', payload: frame });
    sendToClients(payload);
  };

  rfController.on('spectrum', (frame) => {
    latestRfFrame = frame;
    broadcastRfFrame(frame);
  });

  rfController.on('error', (err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[backend][rf-controller]', err);
    }
  });

  rfController.on('disconnect', () => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[backend][rf-controller] rtl_tcp disconnected');
    }
  });

  server.get('/ws', { websocket: true }, (socket: WebSocket) => {
    clients.add(socket);
    try {
      socket.send(JSON.stringify(latestFrame));
      if (latestRfFrame) {
        socket.send(JSON.stringify({ type: 'rf_spectrum', payload: latestRfFrame }));
      }
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

  server.get('/api/aircraft/cached', async (request, reply) => {
    const { limit } = request.query as { limit?: string };
    const limitNum = limit ? parseInt(limit, 10) : 200;
    const cachedAircraft = aircraftDb.getRecent(limitNum);
    reply.send({ aircraft: cachedAircraft });
  });

  server.get('/api/drones', async (_request, reply) => {
    reply.send({ drones: latestFrame.drone.detections });
  });
  server.get('/api/export/drone/:droneId', async (request, reply) => {
    const { droneId } = request.params as { droneId: string };
    const drones = latestFrame.drone.detections;
    const drone = drones.find((entry) => entry.droneId === droneId);
    const header =
      'DroneId,Manufacturer,Model,DroneLat,DroneLon,DroneAltitude,OperatorLat,OperatorLon,Speed,Heading,LastSeen\n';
    const row = drone
      ? `${drone.droneId},${drone.manufacturer ?? ''},${drone.model ?? ''},${drone.droneLat ?? ''},${drone.droneLon ?? ''},${drone.droneAltitude ?? ''},${drone.operatorLat ?? ''},${drone.operatorLon ?? ''},${drone.speed ?? ''},${drone.heading ?? ''},${new Date(drone.lastSeen ?? Date.now()).toISOString()}\n`
      : '';
    const csv = header + row;
    reply.header('Content-Type', 'text/csv');
    reply.header(
      'Content-Disposition',
      `attachment; filename="drone_${encodeURIComponent(droneId)}_${Date.now()}.csv"`,
    );
    return csv;
  });

  server.get('/api/signals', async (_request, reply) => {
    reply.send({ signals: signalDb.getRecent(200) });
  });

  server.post('/api/session/save', async (request, reply) => {
    const { path: targetPath } = (request.body ?? {}) as { path?: string };
    if (!targetPath) {
      reply.code(400).send({ error: 'Missing path' });
      return;
    }

    try {
      try {
        aircraftBatcher.flush();
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[session/save] failed to flush aircraft batcher', err);
        }
      }

      const resolvedPath = path.resolve(targetPath);
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

      await sessionDb.backup(resolvedPath);

      reply.send({ success: true, path: resolvedPath });
    } catch (err) {
      console.error('[session/save] backup failed', err);
      reply
        .code(500)
        .send({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  server.get('/api/stats', async () => ({
    aircraftCount: aircraftDb.getCount(),
    droneCount: latestFrame.drone.detections.length,
    signalCount: signalDb.getCount(),
  }));

  // Get all settings (structured response)
  server.get('/api/settings', async () => {
    const flat = settingsDb.getAll();
    const structured = parseSettings(flat);
    return structured;
  });

  // Update single setting
  server.post('/api/settings', async (request, reply) => {
    const parsed = SettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400);
      return { success: false };
    }
    const { key, value } = parsed.data;
    settingsDb.set(key, value ?? '');

    // Apply dynamic settings that don't require restart
    applyPerformanceSettings(key, value ?? '');

    const needsRestart = requiresRestart([{ key, value: value ?? '' }]);
    return { success: true, requiresRestart: needsRestart };
  });

  // Bulk update settings
  server.post('/api/settings/bulk', async (request, reply) => {
    const body = request.body as { updates?: Array<{ key: string; value: string }> };
    if (!body?.updates || !Array.isArray(body.updates)) {
      reply.code(400).send({ success: false, error: 'Invalid updates array' });
      return;
    }

    try {
      settingsDb.setMany(body.updates);

      // Apply dynamic settings that don't require restart
      for (const { key, value } of body.updates) {
        applyPerformanceSettings(key, value);
      }

      const needsRestart = requiresRestart(body.updates);
      return { success: true, requiresRestart: needsRestart };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Test service connection
  server.post('/api/settings/test-connection', async (request, reply) => {
    const body = request.body as {
      service?: 'dump1090' | 'kismet' | 'rtlTcp' | 'gpsd';
      host?: string;
      port?: number;
    };

    if (!body?.service || !body?.host || !body?.port) {
      reply.code(400).send({ success: false, error: 'Missing service, host, or port' });
      return;
    }

    const startTime = Date.now();
    try {
      // Simple TCP connection test
      const url = `http://${body.host}:${body.port}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      return {
        success: response.ok,
        latencyMs,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const error = err instanceof Error ? err.message : 'Connection failed';
      return { success: false, latencyMs, error };
    }
  });

  // Reset settings to defaults
  server.post('/api/settings/reset', async (request, reply) => {
    const body = request.body as {
      section?: 'services' | 'preferences' | 'notifications' | 'performance';
    };

    try {
      settingsDb.reset(body?.section);
      return { success: true, requiresRestart: body?.section === 'services' };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      reply.code(500).send({ success: false, error: error.message });
    }
  });

  // Legacy endpoint for backward compatibility
  server.post('/api/settings/session-storage', async (request, reply) => {
    const body = request.body as { mode?: 'memory' | 'disk' };
    if (body?.mode !== 'memory' && body?.mode !== 'disk') {
      reply.code(400).send({ success: false, error: 'Invalid mode' });
      return;
    }
    settingsDb.set('session.storageMode', body.mode);
    reply.send({ success: true, message: 'Will apply on next restart.' });
  });

  server.post('/api/scan/start', async (request, reply) => {
    const parseResult = ScanStartSchema.safeParse(request.body ?? {});
    if (!parseResult.success) {
      reply.code(400).send({
        success: false,
        message: 'Invalid scan request payload',
        issues: parseResult.error.issues,
      });
      return;
    }
    try {
      await rfController.start(parseResult.data);
      reply.send({ success: true, message: 'RF scanning started' });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      reply.code(500).send({ success: false, message: error.message });
    }
  });

  server.post('/api/scan/stop', async (_request, reply) => {
    await rfController.stop();
    latestRfFrame = null;
    reply.send({ success: true });
  });

  server.get('/api/export/csv', async (request, reply) => {
    const query = request.query as
      | { table?: string; startTime?: string; endTime?: string }
      | undefined;
    if (!query?.table) {
      reply.code(400).send({ error: 'table query parameter required' });
      return;
    }
    const start = query.startTime ? Number.parseInt(query.startTime, 10) : undefined;
    const end = query.endTime ? Number.parseInt(query.endTime, 10) : undefined;
    const normalizedStart = Number.isFinite(start ?? NaN) ? start : undefined;
    const normalizedEnd = Number.isFinite(end ?? NaN) ? end : undefined;

    if (query.table === 'aircraft') {
      const csv = aircraftDb.exportToCsv(normalizedStart, normalizedEnd);
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="aircraft_${Date.now()}.csv"`);
      return csv;
    }
    if (query.table === 'signals') {
      const csv = signalDb.exportToCsv(normalizedStart, normalizedEnd);
      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="signals_${Date.now()}.csv"`);
      return csv;
    }
    reply.code(400).send({ error: 'Unsupported table' });
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

  const shutdown = async (signal?: NodeJS.Signals | string, code = 0, exit = true) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

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
      aircraftBatcher.dispose();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[backend] batcher dispose error', err);
      }
    }

    try {
      await server.close();
    } catch {
      // ignore close errors
    }

    try {
      await rfController.stop();
      latestRfFrame = null;
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[backend] rf controller shutdown error', err);
      }
    }

    try {
      healthMonitor.stop();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[backend] health monitor shutdown error', err);
      }
    }

    try {
      sessionDb.close();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[backend] session DB close error', err);
      }
    }

    try {
      settingsDb.close();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[backend] settings DB close error', err);
      }
    }

    if (signal && process.env.NODE_ENV !== 'production') {
      console.info(`[backend] exiting via ${signal}`);
    }
    if (exit) {
      process.exit(code);
    }
  };

  // Expose a test-friendly cleanup that tears everything down without exiting the process.
  server.addHook('onClose', async () => {
    if (shuttingDown) {
      return;
    }
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
      aircraftBatcher.dispose();
    } catch {
      // ignore
    }
    try {
      await rfController.stop();
      latestRfFrame = null;
    } catch {
      // ignore
    }
    try {
      healthMonitor.stop();
    } catch {
      // ignore
    }
    try {
      sessionDb.close();
    } catch {
      // ignore
    }
    try {
      settingsDb.close();
    } catch {
      // ignore
    }
    shuttingDown = true;
  });

  if (installProcessHandlers) {
    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
    process.on('uncaughtException', (err) => {
      console.error('[backend] uncaught exception', err);
      void shutdown('uncaughtException', 1);
    });
  }

  const parsedPort = Number.parseInt(process.env.BACKEND_PORT ?? '', 10);
  // Honor an explicit 0 (ephemeral port) while still defaulting when unset/invalid.
  const port = Number.isInteger(parsedPort) && parsedPort >= 0 ? parsedPort : DEFAULT_PORT;

  if (shouldListen) {
    try {
      await server.listen({ host: BACKEND_HOST, port });
      if (process.env.NODE_ENV !== 'production') {
        console.info(`[backend] listening on http://${BACKEND_HOST}:${port}`);
      }
    } catch (err) {
      console.error('[backend] failed to start server', err);
      await shutdown('startup-error', 1);
    }
  } else {
    await server.ready();
  }

  return server;
}

// Auto-start the server only when run directly as the CLI entry, not when imported.
const isMain = (() => {
  try {
    const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return Boolean(entry) && import.meta.url === `file://${entry}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  void buildServer();
}
