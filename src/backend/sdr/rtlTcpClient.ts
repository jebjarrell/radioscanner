import net from 'node:net';

import { RTL_TCP_CONFIG } from '../../config/index.js';
import { TypedEventEmitter } from '../utils/typedEventEmitter.js';

export interface RtlTcpOptions {
  host?: string;
  port?: number;
  centerHz: number;
  sampleRate: number;
  gain?: number | 'auto';
}

type RtlTcpEvents = {
  connect: () => void;
  disconnect: () => void;
  error: (err: Error) => void;
  iq: (buffer: Buffer) => void;
};

export class RtlTcpClient extends TypedEventEmitter<RtlTcpEvents> {
  private socket: net.Socket | null = null;
  private connected = false;

  constructor(private readonly options: RtlTcpOptions) {
    super();
  }

  isConnected(): boolean {
    return this.connected;
  }

  async start(): Promise<void> {
    await this.connect();
  }

  stop(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket.removeAllListeners();
    }
    this.socket = null;
    this.connected = false;
    this.emit('disconnect');
  }

  private async connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    const host = this.options.host ?? RTL_TCP_CONFIG.host;
    const port = this.options.port ?? RTL_TCP_CONFIG.port;

    this.socket = net.createConnection({ host, port });

    this.socket.on('connect', () => {
      this.connected = true;
      this.emit('connect');
    });

    this.socket.on('error', (err) => {
      this.emit('error', err);
    });

    this.socket.on('close', () => {
      this.connected = false;
      this.emit('disconnect');
    });

    let buffer = Buffer.alloc(0);
    this.socket.on('data', (chunk) => {
      if (!chunk.length) {
        return;
      }
      buffer = Buffer.concat([buffer, chunk]);
      this.emit('iq', buffer);
      buffer = Buffer.alloc(0);
    });
  }
}
