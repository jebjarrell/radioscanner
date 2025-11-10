import net from 'node:net';
import { TypedEventEmitter } from './utils/typedEventEmitter.js';
export class RtlTcpClient extends TypedEventEmitter {
    host;
    port;
    socket = null;
    status = {
        connected: false,
    };
    constructor(host = '127.0.0.1', port = 1234) {
        super();
        this.host = host;
        this.port = port;
    }
    async connect() {
        if (this.socket && !this.socket.destroyed) {
            return;
        }
        this.socket = net.createConnection({ host: this.host, port: this.port, timeout: 2_000 }, () => {
            this.status.connected = true;
            this.status.lastConnectedAt = Date.now();
            this.emit('connected');
        });
        const cleanupSocket = () => {
            if (!this.socket) {
                return;
            }
            this.socket.removeAllListeners();
            this.socket = null;
        };
        this.socket.once('close', () => {
            this.status.connected = false;
            this.emit('disconnected');
            cleanupSocket();
        });
        this.socket.once('error', (err) => {
            this.status.connected = false;
            this.status.lastError = err.message;
            this.emit('error', err);
            cleanupSocket();
        });
        this.socket.once('data', (chunk) => {
            const banner = chunk.toString('utf8').trim();
            if (banner) {
                this.status.banner = banner;
                this.emit('banner', banner);
            }
        });
        try {
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    cleanup();
                    reject(new Error('Timeout waiting for rtl_tcp connection'));
                }, 2_000);
                const onConnected = () => {
                    cleanup();
                    resolve();
                };
                const onError = (err) => {
                    cleanup();
                    reject(err);
                };
                const cleanup = () => {
                    clearTimeout(timer);
                    this.off('connected', onConnected);
                    this.off('error', onError);
                };
                this.once('connected', onConnected);
                this.once('error', onError);
            });
        }
        catch (err) {
            this.disconnect();
            throw err;
        }
    }
    disconnect() {
        if (this.socket) {
            this.socket.destroy();
            this.socket.removeAllListeners();
            this.socket = null;
        }
        this.status.connected = false;
    }
    async start() {
        if (!this.status.connected) {
            await this.connect();
        }
    }
    async stop() {
        this.disconnect();
    }
    async tune(frequencyHz) {
        // Placeholder for MVP; extend with proper SET_FREQUENCY command framing.
        void frequencyHz;
    }
    getStatus() {
        return { ...this.status };
    }
}
