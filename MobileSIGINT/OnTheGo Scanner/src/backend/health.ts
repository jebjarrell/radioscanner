import { WebSocketServer } from 'ws';

import type { ServiceKey } from '../types/services.js';
import { SERVICE_KEYS } from '../types/services.js';

import { BluetoothRidClient } from './clients/bluetoothRidClient.js';
import { KismetRidClient, RemoteIdPayload } from './clients/kismetRid.js';
import { MAX_AIRCRAFT } from './constants.js';
import { Dump1090Client, Dump1090Snapshot } from './dump1090Client.js';
import { GpsClient, GpsStatus } from './gpsClient.js';
import { KismetClient, KismetStatus } from './kismetClient.js';
import {
  MockDump1090Client,
  MockGpsClient,
  MockKismetClient,
  MockRtlTcpClient,
} from './mockClients.js';
import { RtlTcpClient, RtlTcpStatus } from './rtlTcpClient.js';
import { TelemetryBatcher, TelemetryRecord } from './storage/telemetryBatcher.js';
import { TypedEventEmitter } from './utils/typedEventEmitter.js';

const TELEMETRY_INTERVAL_MS = 1_000;
const DEFAULT_WS_PORT = 8_787;

export interface HealthSnapshot {
  rtlTcp: RtlTcpStatus;
  dump1090: ReturnType<Dump1090Client['getStatus']>;
  kismet: KismetStatus;
  gps: GpsStatus;
  timestamp: number;
}

export interface TelemetryFrame {
  timestamp: string;
  health: HealthSnapshot;
  aircraft: Dump1090Snapshot['aircraft'];
  drone: {
    ridAvailable: boolean;
    detections: RemoteIdPayload[];
  };
  signals: {
    rtlTcpConnected: boolean;
    gpsConnected: boolean;
  };
}

interface HealthMonitorOptions {
  wsPort?: number;
  useMockData?: boolean;
  disableWebSocket?: boolean;
}

type HealthEvents = {
  health: (snapshot: TelemetryFrame) => void;
  error: (err: Error) => void;
};

type DumpClient = Dump1090Client | MockDump1090Client;
type RtlClient = RtlTcpClient | MockRtlTcpClient;
type KismetLikeClient = KismetClient | MockKismetClient;
type GpsLikeClient = GpsClient | MockGpsClient;

export class HealthMonitor extends TypedEventEmitter<HealthEvents> {
  private readonly rtlTcp: RtlClient;
  private readonly dump1090: DumpClient;
  private readonly kismet: KismetLikeClient;
  private readonly kismetRidClient: KismetRidClient;
  private readonly bluetoothRidClient: BluetoothRidClient;
  private readonly gps: GpsLikeClient;
  private readonly telemetryBatcher = new TelemetryBatcher<TelemetryRecord>((batch) =>
    this.flushTelemetryBatch(batch),
  );

  private wsServer: WebSocketServer | null = null;
  private telemetryTimer: NodeJS.Timeout | null = null;
  private lastDumpSnapshot: Dump1090Snapshot | null = null;
  private readonly wsPort: number;
  private readonly disableWebSocket: boolean;

  constructor(options: HealthMonitorOptions = {}) {
    super();
    const useMockData =
      typeof options.useMockData === 'boolean'
        ? options.useMockData
        : parseBooleanEnv(process.env.USE_MOCK_DATA);
    this.disableWebSocket =
      typeof options.disableWebSocket === 'boolean' ? options.disableWebSocket : false;
    this.wsPort = typeof options.wsPort === 'number' ? options.wsPort : DEFAULT_WS_PORT;
    const clients = useMockData ? createMockClients() : createRealClients();
    this.rtlTcp = clients.rtlTcp;
    this.dump1090 = clients.dump1090;
    this.kismet = clients.kismet;
    this.kismetRidClient = clients.kismetRidClient;
    this.bluetoothRidClient = clients.bluetoothRidClient;
    this.gps = clients.gps;
    this.attachClientEvents();
  }

  async start(): Promise<void> {
    await this.startClients();
    // Start Bluetooth scanning (gracefully handles failures)
    await this.bluetoothRidClient.start();
    this.startTelemetryPipeline();
  }

  stop(): void {
    this.telemetryTimer && clearInterval(this.telemetryTimer);
    this.telemetryTimer = null;
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }
    this.dump1090.stop();
    this.kismet.stop();
    this.bluetoothRidClient.stop();
    this.rtlTcp.stop().catch(() => undefined);
    this.gps.stop();
    this.telemetryBatcher.dispose();
  }

  async getSnapshot(): Promise<TelemetryFrame> {
    return this.buildTelemetryFrame();
  }

  async retry(service: string): Promise<boolean> {
    if (!service) {
      return false;
    }
    const normalized = service.trim() as ServiceKey;
    if (!SERVICE_KEYS.includes(normalized)) {
      return false;
    }

    try {
      switch (normalized) {
        case 'rtlTcp':
          await this.rtlTcp.stop();
          await this.rtlTcp.start();
          return true;
        case 'dump1090':
          this.dump1090.stop();
          this.dump1090.start();
          return true;
        case 'kismet':
          this.kismet.stop();
          this.kismet.start();
          return true;
        case 'gps':
          this.gps.stop();
          await this.gps.start();
          return true;
        default: {
          const unknownService: string = typeof service === 'string' ? service : 'unknown';
          throw new Error(`Unsupported service retry: ${unknownService}`);
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
      return false;
    }
  }

  getGpsPosition(): {
    lat: number | null;
    lon: number | null;
    fix: boolean;
    timestamp: number;
  } {
    const status = this.gps.getStatus();
    const fix = status.lastFix ?? null;
    if (fix && typeof fix.lat === 'number' && typeof fix.lon === 'number') {
      return {
        lat: fix.lat,
        lon: fix.lon,
        fix: true,
        timestamp: fix.timestamp,
      };
    }
    return {
      lat: null,
      lon: null,
      fix: false,
      timestamp: Date.now(),
    };
  }

  private attachClientEvents(): void {
    this.rtlTcp.on('banner', () => this.emitHealth());
    this.rtlTcp.on('connected', () => this.emitHealth());
    this.rtlTcp.on('disconnected', () => this.emitHealth());
    this.rtlTcp.on('error', (err) => this.emit('error', err));

    this.dump1090.on('data', (snapshot) => {
      this.lastDumpSnapshot = snapshot;
      this.emitHealth();
    });
    this.dump1090.on('error', (err) => this.emit('error', err));

    this.kismet.on('status', () => this.emitHealth());
    this.kismet.on('error', (err) => this.emit('error', err));

    this.gps.on('connected', () => this.emitHealth());
    this.gps.on('disconnected', () => this.emitHealth());
    this.gps.on('error', (err) => this.emit('error', err));
  }

  private async startClients(): Promise<void> {
    try {
      await this.rtlTcp.start();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
    }

    this.dump1090.start();
    this.kismet.start();

    try {
      await this.gps.start();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
    }
  }

  private startTelemetryPipeline(): void {
    if (!this.disableWebSocket && !this.wsServer) {
      this.wsServer = new WebSocketServer({ port: this.wsPort });

      this.wsServer.on('connection', (socket) => {
        // Send initial telemetry frame asynchronously
        void this.buildTelemetryFrame()
          .then((frame) => socket.send(JSON.stringify(frame)))
          .catch(() => {
            // ignore initial send errors
          });
      });

      this.wsServer.on('error', (err) => this.emit('error', err as Error));
    }

    if (this.telemetryTimer) {
      return;
    }

    this.telemetryTimer = setInterval(() => {
      // Build telemetry frame asynchronously
      void this.buildTelemetryFrame().then((frame) => {
        const payload = JSON.stringify(frame);
        if (this.wsServer) {
          this.wsServer.clients.forEach((client) => {
            if (client.readyState === client.OPEN) {
              client.send(payload);
            }
          });
        }
        this.emit('health', frame);
        this.telemetryBatcher.enqueue({
          timestamp: frame.health.timestamp,
          aircraftCount: frame.aircraft.length,
          droneAvailable: frame.drone.ridAvailable,
          rtlConnected: frame.signals.rtlTcpConnected,
          gpsConnected: frame.signals.gpsConnected,
        });
      });
    }, TELEMETRY_INTERVAL_MS);
  }

  private emitHealth(): void {
    // Build telemetry frame asynchronously
    void this.buildTelemetryFrame().then((frame) => {
      if (this.wsServer) {
        const payload = JSON.stringify(frame);
        this.wsServer.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(payload);
          }
        });
      }
      this.emit('health', frame);
    });
  }

  private async buildTelemetryFrame(): Promise<TelemetryFrame> {
    const rtlStatus = this.rtlTcp.getStatus();
    const rawDumpStatus = this.dump1090.getStatus();
    const kismetStatus = this.kismet.getStatus();
    const gpsStatus = this.gps.getStatus();
    const now = Date.now();

    const dumpStatus = {
      ...rawDumpStatus,
      healthy:
        rawDumpStatus.healthy &&
        typeof rawDumpStatus.lastUpdated === 'number' &&
        now - rawDumpStatus.lastUpdated < 5_000,
    };

    const gpsDerived: GpsStatus = {
      ...gpsStatus,
      connected:
        gpsStatus.connected && (!gpsStatus.lastChecked || now - gpsStatus.lastChecked < 10_000),
    };

    const healthSnapshot: HealthSnapshot = {
      rtlTcp: rtlStatus,
      dump1090: dumpStatus,
      kismet: kismetStatus,
      gps: gpsDerived,
      timestamp: now,
    };

    const aircraft =
      this.lastDumpSnapshot?.aircraft ?? this.dump1090.getLastSnapshot()?.aircraft ?? [];
    const limitedAircraft = aircraft.slice(0, MAX_AIRCRAFT);

    // Fetch drone detections from multiple sources
    const kismetDrones = await this.kismetRidClient.fetchRemoteId();
    const bluetoothDrones = this.bluetoothRidClient.getDetections();

    // Merge and deduplicate detections from both sources
    const droneDetections = this.mergeDroneDetections([...kismetDrones, ...bluetoothDrones]);

    return {
      timestamp: new Date().toISOString(),
      health: healthSnapshot,
      aircraft: limitedAircraft,
      drone: {
        ridAvailable: kismetStatus.ridEnabled,
        detections: droneDetections,
      },
      signals: {
        rtlTcpConnected: rtlStatus.connected,
        gpsConnected: gpsDerived.connected,
      },
    };
  }

  /**
   * Merge and deduplicate drone detections from multiple sources
   * Prefers Bluetooth data (more complete) over Wi-Fi when both available
   */
  private mergeDroneDetections(drones: RemoteIdPayload[]): RemoteIdPayload[] {
    const map = new Map<string, RemoteIdPayload>();

    for (const drone of drones) {
      const existing = map.get(drone.droneId);

      if (!existing) {
        // First time seeing this drone
        map.set(drone.droneId, drone);
      } else {
        // Merge data - prefer Bluetooth (has operator location) over Wi-Fi
        const merged: RemoteIdPayload = { ...existing };

        // Prefer non-null values from either source
        if (drone.manufacturer && !merged.manufacturer) {
          merged.manufacturer = drone.manufacturer;
        }
        if (drone.model && !merged.model) {
          merged.model = drone.model;
        }
        if (drone.uaType && !merged.uaType) {
          merged.uaType = drone.uaType;
        }
        if (drone.droneLat !== null) {
          merged.droneLat = drone.droneLat;
        }
        if (drone.droneLon !== null) {
          merged.droneLon = drone.droneLon;
        }
        if (drone.droneAltitude !== null) {
          merged.droneAltitude = drone.droneAltitude;
        }
        if (drone.operatorLat !== null) {
          merged.operatorLat = drone.operatorLat;
        }
        if (drone.operatorLon !== null) {
          merged.operatorLon = drone.operatorLon;
        }
        if (drone.speed !== null) {
          merged.speed = drone.speed;
        }
        if (drone.heading !== null) {
          merged.heading = drone.heading;
        }

        // Use most recent lastSeen
        merged.lastSeen = Math.max(existing.lastSeen, drone.lastSeen);

        map.set(drone.droneId, merged);
      }
    }

    return Array.from(map.values());
  }

  private flushTelemetryBatch(batch: TelemetryRecord[]): void {
    if (batch.length === 0) {
      return;
    }
    // Placeholder for database insertion; batches are discarded after flush for now.
    void batch;
  }
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function createRealClients(): {
  rtlTcp: RtlTcpClient;
  dump1090: Dump1090Client;
  kismet: KismetClient;
  kismetRidClient: KismetRidClient;
  bluetoothRidClient: BluetoothRidClient;
  gps: GpsClient;
} {
  return {
    rtlTcp: new RtlTcpClient(),
    dump1090: new Dump1090Client(),
    kismet: new KismetClient(),
    kismetRidClient: new KismetRidClient(),
    bluetoothRidClient: new BluetoothRidClient(),
    gps: new GpsClient(),
  };
}

function createMockClients(): {
  rtlTcp: MockRtlTcpClient;
  dump1090: MockDump1090Client;
  kismet: MockKismetClient;
  kismetRidClient: KismetRidClient;
  bluetoothRidClient: BluetoothRidClient;
  gps: MockGpsClient;
} {
  return {
    rtlTcp: new MockRtlTcpClient(),
    dump1090: new MockDump1090Client(),
    kismet: new MockKismetClient(),
    kismetRidClient: new KismetRidClient(), // Use real client for both (returns empty array on error)
    bluetoothRidClient: new BluetoothRidClient(), // Use real client (gracefully handles BT unavailable)
    gps: new MockGpsClient(),
  };
}
