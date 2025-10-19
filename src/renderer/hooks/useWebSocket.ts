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
            setTelemetry(JSON.parse(payload) as TelemetryFrame);
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
