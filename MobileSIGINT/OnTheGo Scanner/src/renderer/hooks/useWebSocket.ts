import { useEffect, useState } from 'react';

import { connectWS } from '../services/wsReconnect';
import type { TelemetryFrame } from '../types';

const DECODER = new TextDecoder();

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

export const useWebSocket = (url: string) => {
  const [telemetry, setTelemetry] = useState<TelemetryFrame | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const stop = connectWS(
      url,
      {
        onOpen: () => setConnected(true),
        onClose: () => setConnected(false),
        onError: () => setConnected(false),
        onMessage: (event) => {
          try {
            const payload = decodePayload(event.data);
            if (!payload) {
              return;
            }
            const parsed = JSON.parse(payload) as Record<string, unknown>;
            // The socket also carries tagged envelopes (e.g. rf_spectrum);
            // only untagged frames are telemetry. Treating an envelope as a
            // telemetry frame clobbers state with a shape consumers can't read.
            if (parsed && typeof parsed === 'object' && 'type' in parsed) {
              return;
            }
            setTelemetry(parsed as unknown as TelemetryFrame);
          } catch (err) {
            console.error('Bad telemetry frame', err);
          }
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
