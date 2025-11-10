import { TELEMETRY_BATCH_FLUSH_MS, TELEMETRY_BATCH_SIZE } from '../constants.js';
export class TelemetryBatcher {
    onFlush;
    buffer = [];
    flushTimer = null;
    constructor(onFlush) {
        this.onFlush = onFlush;
    }
    enqueue(record) {
        this.buffer.push(record);
        if (this.buffer.length >= TELEMETRY_BATCH_SIZE) {
            this.flush();
            return;
        }
        this.scheduleFlush();
    }
    flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.buffer.length === 0) {
            return;
        }
        const batch = this.buffer.splice(0, this.buffer.length);
        this.onFlush(batch);
    }
    dispose() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        this.flush();
    }
    scheduleFlush() {
        if (this.flushTimer) {
            return;
        }
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flush();
        }, TELEMETRY_BATCH_FLUSH_MS);
    }
}
