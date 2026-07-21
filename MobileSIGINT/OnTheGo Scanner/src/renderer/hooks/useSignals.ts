import { useEffect, useState } from 'react';

import { BACKEND_URL } from '../../config/client.js';

export interface SignalSample {
  ts: number;
  frequency: number;
  signalStrength: number;
  bandwidth: number;
}

export const useSignals = (): SignalSample[] => {
  const [signals, setSignals] = useState<SignalSample[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/signals`);
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { signals?: SignalSample[] };
        if (!cancelled && Array.isArray(payload.signals)) {
          setSignals(payload.signals);
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[signals] failed to load recent signals', err);
        }
      }
    };

    load();
    const interval = setInterval(load, 2_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return signals;
};
