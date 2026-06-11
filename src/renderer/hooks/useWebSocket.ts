import { useEffect, useState } from 'react';

import { connectWS } from '../services/wsReconnect';
import type { TelemetryFrame } from '../types';

const DECODER = new TextDecoder();
const BAD_FRAME_LOG_INTERVAL_MS = 5000;

function decodePayload(data: unknown): string | null {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return DECODER.decode(data);
  }
  if (ArrayBuffer.isView(data)) {
    return DECODER.decode(data as ArrayBufferView);
  }
  return null;
}

function isTelemetryFrame(value: unknown): value is TelemetryFrame {
  return typeof value === 'object' && value !== null;
}

export const useWebSocket = (url: string) => {
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Throttle bad-frame logging so a stream of malformed messages can't spam
    // the console. The connection itself is always kept alive.
    let lastBadFrameLog = 0;
    let suppressedBadFrames = 0;

    const logBadFrame = (reason: string, detail?: unknown): void => {
      suppressedBadFrames += 1;
      const now = Date.now();
      if (now - lastBadFrameLog < BAD_FRAME_LOG_INTERVAL_MS) {
        return;
      }
      lastBadFrameLog = now;
      const count = suppressedBadFrames;
      suppressedBadFrames = 0;
      console.warn(
        `[useWebSocket] Discarded ${count} malformed telemetry frame(s): ${reason}`,
        detail,
      );
    };

    const stop = connectWS(
      url,
      {
        onOpen: () => setConnected(true),
        onClose: () => setConnected(false),
        onError: () => setConnected(false),
        onMessage: (event) => {
          let payload: string | null;
          try {
            payload = decodePayload(event.data);
          } catch (err) {
            logBadFrame('failed to decode payload', err);
            return;
          }

          if (!payload) {
            return;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch (err) {
            logBadFrame('invalid JSON', err);
            return;
          }

          if (!isTelemetryFrame(parsed)) {
            logBadFrame('unexpected message shape', parsed);
            return;
          }

          setTelemetry(parsed);
        },
      },
      {
        initialDelayMs: 1000,
        maxDelayMs: 15000,
        randomJitterMs: 500,
      },
    );

    return () => {
      stop();
    };
  }, [url]);

  return { telemetry, connected };
};
