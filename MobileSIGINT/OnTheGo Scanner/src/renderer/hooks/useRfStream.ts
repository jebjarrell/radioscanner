import { useEffect, useState } from 'react';

import { WEBSOCKET_URL } from '../../config/client.js';
import { connectWS } from '../services/wsReconnect';

export type RfSpectrumFrame = {
  startHz: number;
  binSizeHz: number;
  bins: number[];
  ts: number;
  peaks?: Array<{ frequency: number; power: number }>;
};

const DECODER = new TextDecoder();

const decodePayload = (data: unknown): string | null => {
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
};

export function useRfStream(): RfSpectrumFrame | null {
  const [frame, setFrame] = useState<RfSpectrumFrame | null>(null);

  useEffect(() => {
    const stop = connectWS(
      WEBSOCKET_URL,
      {
        onMessage: (event) => {
          try {
            const raw = decodePayload(event.data);
            if (!raw) {
              return;
            }
            const payload = JSON.parse(raw);
            if (payload?.type === 'rf_spectrum') {
              setFrame(payload.payload as RfSpectrumFrame);
            }
          } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
              console.error('[rf] bad spectrum frame', err);
            }
          }
        },
      },
      {
        initialDelayMs: 1_000,
        maxDelayMs: 15_000,
        randomJitterMs: 500,
      },
    );

    return () => {
      stop();
    };
  }, []);

  return frame;
}
