import { TELEMETRY_BATCH_FLUSH_MS, TELEMETRY_BATCH_SIZE } from '../constants.js';

export interface TelemetryRecord {
  timestamp: number;
  aircraftCount: number;
  droneAvailable: boolean;
  rtlConnected: boolean;
  gpsConnected: boolean;
}

export class TelemetryBatcher<T> {
  private buffer: T[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly onFlush: (batch: T[]) => void,
    private readonly batchSize: number = TELEMETRY_BATCH_SIZE,
    private readonly flushMs: number = TELEMETRY_BATCH_FLUSH_MS,
  ) {}

  enqueue(record: T): void {
    this.buffer.push(record);
    if (this.buffer.length >= this.batchSize) {
      this.flush();
      return;
    }
    this.scheduleFlush();
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buffer.length === 0) {
      return;
    }
    const batch = this.buffer.splice(0, this.buffer.length);
    this.onFlush(batch);
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush();
  }

  private scheduleFlush(): void {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.flushMs);
  }
}
