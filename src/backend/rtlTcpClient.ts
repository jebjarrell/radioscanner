import net from 'node:net';

import { TypedEventEmitter } from './utils/typedEventEmitter.js';
import { RTL_TCP_CONFIG } from '../config/index.js';

export interface RtlTcpStatus {
  connected: boolean;
  banner?: string;
  lastError?: string;
  lastConnectedAt?: number;
}

export type RtlTcpEventMap = {
  connected: () => void;
  disconnected: () => void;
  error: (err: Error) => void;
  banner: (banner: string) => void;
};

export class RtlTcpClient extends TypedEventEmitter<RtlTcpEventMap> {
  private socket: net.Socket | null = null;
  private status: RtlTcpStatus = {
    connected: false,
  };

  constructor(
    private readonly host = RTL_TCP_CONFIG.host,
    private readonly port = RTL_TCP_CONFIG.port,
  ) {
    super();
  }

  async connect(): Promise<void> {
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
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('Timeout waiting for rtl_tcp connection'));
        }, 2_000);

        const onConnected = () => {
          cleanup();
          resolve();
        };

        const onError = (err: Error) => {
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
    } catch (err) {
      this.disconnect();
      throw err;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket.removeAllListeners();
      this.socket = null;
    }
    this.status.connected = false;
  }

  async start(): Promise<void> {
    if (!this.status.connected) {
      await this.connect();
    }
  }

  async stop(): Promise<void> {
    this.disconnect();
  }

  async tune(frequencyHz: number): Promise<void> {
    // Placeholder for MVP; extend with proper SET_FREQUENCY command framing.
    void frequencyHz;
  }

  getStatus(): RtlTcpStatus {
    return { ...this.status };
  }
}
