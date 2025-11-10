import { WebSocketServer } from 'ws';
import { MAX_AIRCRAFT } from './constants.js';
import { Dump1090Client } from './dump1090Client.js';
import { GpsClient } from './gpsClient.js';
import { KismetClient } from './kismetClient.js';
import { MockDump1090Client, MockGpsClient, MockKismetClient, MockRtlTcpClient, } from './mockClients.js';
import { RtlTcpClient } from './rtlTcpClient.js';
import { TelemetryBatcher } from './storage/telemetryBatcher.js';
import { TypedEventEmitter } from './utils/typedEventEmitter.js';
const TELEMETRY_INTERVAL_MS = 1_000;
const DEFAULT_WS_PORT = 8_787;
export class HealthMonitor extends TypedEventEmitter {
    options;
    rtlTcp;
    dump1090;
    kismet;
    gps;
    telemetryBatcher = new TelemetryBatcher((batch) => this.flushTelemetryBatch(batch));
    wsServer = null;
    telemetryTimer = null;
    lastDumpSnapshot = null;
    constructor(options = {}) {
        super();
        this.options = options;
        const useMockData = typeof options.useMockData === 'boolean'
            ? options.useMockData
            : parseBooleanEnv(process.env.USE_MOCK_DATA);
        const clients = useMockData ? createMockClients() : createRealClients();
        this.rtlTcp = clients.rtlTcp;
        this.dump1090 = clients.dump1090;
        this.kismet = clients.kismet;
        this.gps = clients.gps;
        this.attachClientEvents();
    }
    async start() {
        await this.startClients();
        this.startTelemetryServer();
    }
    stop() {
        this.telemetryTimer && clearInterval(this.telemetryTimer);
        this.telemetryTimer = null;
        if (this.wsServer) {
            this.wsServer.close();
            this.wsServer = null;
        }
        this.dump1090.stop();
        this.kismet.stop();
        this.rtlTcp.stop().catch(() => undefined);
        this.gps.stop();
        this.telemetryBatcher.dispose();
    }
    getSnapshot() {
        return this.buildTelemetryFrame();
    }
    attachClientEvents() {
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
    async startClients() {
        try {
            await this.rtlTcp.start();
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.emit('error', error);
        }
        this.dump1090.start();
        this.kismet.start();
        try {
            await this.gps.start();
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.emit('error', error);
        }
    }
    startTelemetryServer() {
        const port = this.options.wsPort ?? DEFAULT_WS_PORT;
        this.wsServer = new WebSocketServer({ port });
        this.wsServer.on('connection', (socket) => {
            try {
                socket.send(JSON.stringify(this.buildTelemetryFrame()));
            }
            catch {
                // ignore initial send errors
            }
        });
        this.wsServer.on('error', (err) => this.emit('error', err));
        this.telemetryTimer = setInterval(() => {
            const frame = this.buildTelemetryFrame();
            const payload = JSON.stringify(frame);
            this.wsServer?.clients.forEach((client) => {
                if (client.readyState === client.OPEN) {
                    client.send(payload);
                }
            });
            this.emit('health', frame);
            this.telemetryBatcher.enqueue({
                timestamp: frame.health.timestamp,
                aircraftCount: frame.aircraft.length,
                droneAvailable: frame.drone.ridAvailable,
                rtlConnected: frame.signals.rtlTcpConnected,
                gpsConnected: frame.signals.gpsConnected,
            });
        }, TELEMETRY_INTERVAL_MS);
    }
    emitHealth() {
        if (!this.wsServer) {
            return;
        }
        const frame = this.buildTelemetryFrame();
        this.emit('health', frame);
    }
    buildTelemetryFrame() {
        const rtlStatus = this.rtlTcp.getStatus();
        const rawDumpStatus = this.dump1090.getStatus();
        const kismetStatus = this.kismet.getStatus();
        const gpsStatus = this.gps.getStatus();
        const now = Date.now();
        const dumpStatus = {
            ...rawDumpStatus,
            healthy: rawDumpStatus.healthy &&
                typeof rawDumpStatus.lastUpdated === 'number' &&
                now - rawDumpStatus.lastUpdated < 5_000,
        };
        const gpsDerived = {
            ...gpsStatus,
            connected: gpsStatus.connected && (!gpsStatus.lastChecked || now - gpsStatus.lastChecked < 10_000),
        };
        const healthSnapshot = {
            rtlTcp: rtlStatus,
            dump1090: dumpStatus,
            kismet: kismetStatus,
            gps: gpsDerived,
            timestamp: now,
        };
        const aircraft = this.lastDumpSnapshot?.aircraft ?? this.dump1090.getLastSnapshot()?.aircraft ?? [];
        const limitedAircraft = aircraft.slice(0, MAX_AIRCRAFT);
        return {
            timestamp: new Date().toISOString(),
            health: healthSnapshot,
            aircraft: limitedAircraft,
            drone: {
                ridAvailable: kismetStatus.ridEnabled,
            },
            signals: {
                rtlTcpConnected: rtlStatus.connected,
                gpsConnected: gpsDerived.connected,
            },
        };
    }
    flushTelemetryBatch(batch) {
        if (batch.length === 0) {
            return;
        }
        // Placeholder for database insertion; batches are discarded after flush for now.
        void batch;
    }
}
function parseBooleanEnv(value) {
    if (!value) {
        return false;
    }
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
}
function createRealClients() {
    return {
        rtlTcp: new RtlTcpClient(),
        dump1090: new Dump1090Client(),
        kismet: new KismetClient(),
        gps: new GpsClient(),
    };
}
function createMockClients() {
    return {
        rtlTcp: new MockRtlTcpClient(),
        dump1090: new MockDump1090Client(),
        kismet: new MockKismetClient(),
        gps: new MockGpsClient(),
    };
}
