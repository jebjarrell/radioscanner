import net from 'node:net';
import { LAT_MAX, LAT_MIN, LON_MAX, LON_MIN } from './constants.js';
import { getManualGpsFallback } from './settings.js';
import { TypedEventEmitter } from './utils/typedEventEmitter.js';
export class GpsClient extends TypedEventEmitter {
    host;
    port;
    socket = null;
    status = { connected: false, lastFix: null };
    constructor(host = '127.0.0.1', port = 2947) {
        super();
        this.host = host;
        this.port = port;
    }
    async start() {
        if (this.socket && !this.socket.destroyed) {
            return;
        }
        await new Promise((resolve, reject) => {
            const socket = net.createConnection({ host: this.host, port: this.port }, () => {
                this.socket = socket;
                this.status.connected = true;
                this.status.lastChecked = Date.now();
                socket.write('?WATCH={"enable":false}\n');
                this.emit('connected');
                resolve();
            });
            const handleError = (err) => {
                this.status.connected = false;
                this.status.lastError = err.message;
                this.status.lastChecked = Date.now();
                this.emit('error', err);
                socket.destroy();
                reject(err);
            };
            socket.once('error', handleError);
            socket.once('close', () => {
                this.status.connected = false;
                this.emit('disconnected');
                if (this.socket === socket) {
                    this.socket = null;
                }
            });
        });
    }
    stop() {
        if (this.socket) {
            this.socket.destroy();
            this.socket.removeAllListeners();
            this.socket = null;
        }
        this.status.connected = false;
        this.status.lastChecked = Date.now();
    }
    getStatus() {
        const status = { ...this.status };
        const manual = getManualGpsFallback();
        const hasFix = status.lastFix &&
            typeof status.lastFix.lat === 'number' &&
            typeof status.lastFix.lon === 'number';
        if (!hasFix && manual.enabled && manual.lat !== null && manual.lon !== null) {
            status.lastFix = {
                lat: manual.lat,
                lon: manual.lon,
                alt: undefined,
                timestamp: manual.updatedAt ?? Date.now(),
            };
        }
        return status;
    }
    setLastFix(fix) {
        const lat = clamp(fix.lat, LAT_MIN, LAT_MAX);
        const lon = clamp(fix.lon, LON_MIN, LON_MAX);
        const alt = typeof fix.alt === 'number' && Number.isFinite(fix.alt) ? fix.alt : undefined;
        this.status.lastFix = {
            lat,
            lon,
            alt,
            timestamp: fix.timestamp,
        };
    }
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
