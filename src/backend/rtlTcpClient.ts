import net from 'node:net';

import { RTL_TCP_CONFIG } from '../config/index.js';

import { BackoffController } from './utils/backoff.js';
import { TypedEventEmitter } from './utils/typedEventEmitter.js';

const CONNECT_TIMEOUT_MS = 2_000;

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
  private readonly backoff = new BackoffController();
  private running = false;
  private reportedDown = false;

  constructor(
    private readonly host = RTL_TCP_CONFIG.host,
    private readonly port = RTL_TCP_CONFIG.port,
  ) {
    super();
  }

  private connect(): void {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    const socket = net.createConnection(
      { host: this.host, port: this.port, timeout: CONNECT_TIMEOUT_MS },
      () => {
        socket.setTimeout(0);
        this.status.connected = true;
        this.status.lastConnectedAt = Date.now();
        this.backoff.reset();
        if (this.reportedDown) {
          this.reportedDown = false;
        }
        this.emit('connected');
      },
    );
    this.socket = socket;

    const handleDown = (err?: Error) => {
      if (this.socket !== socket) {
        return;
      }
      const wasConnected = this.status.connected;
      this.status.connected = false;
      if (err) {
        this.status.lastError = err.message;
      }
      socket.removeAllListeners();
      socket.destroy();
      this.socket = null;

      if (wasConnected) {
        this.emit('disconnected');
      }
      // Surface the error only on the transition into the down state, not on
      // every backoff retry, so an absent rtl_tcp doesn't spam consumers.
      if (err && !this.reportedDown) {
        this.emit('error', err);
      }
      this.scheduleReconnect();
    };

    socket.once('timeout', () => {
      handleDown(new Error('Timeout waiting for rtl_tcp connection'));
    });

    socket.once('close', () => {
      handleDown();
    });

    socket.once('error', (err) => {
      handleDown(err);
    });

    socket.on('data', (chunk) => {
      const banner = chunk.toString('utf8').trim();
      if (banner && !this.status.banner) {
        this.status.banner = banner;
        this.emit('banner', banner);
      }
    });
  }

  private scheduleReconnect(): void {
    if (!this.running) {
      return;
    }
    // Log a single state transition when the link first goes down, not on
    // every failed attempt, to keep startup-without-hardware output calm.
    if (!this.reportedDown) {
      this.reportedDown = true;
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[rtl_tcp] connection unavailable; retrying with backoff');
      }
    }
    this.backoff.schedule(() => this.connect());
  }

  disconnect(): void {
    this.backoff.cancel();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.status.connected = false;
  }

  async start(): Promise<void> {
    // Manual (re)start resets backoff so a user-triggered retry attempts
    // immediately instead of waiting out a previously grown delay.
    this.running = true;
    this.reportedDown = false;
    this.backoff.reset();
    if (!this.status.connected) {
      this.connect();
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.reportedDown = false;
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
