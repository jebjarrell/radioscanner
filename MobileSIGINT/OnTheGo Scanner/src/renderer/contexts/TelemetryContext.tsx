import React, { createContext, useContext, useEffect, useState } from 'react';

import { useWebSocket } from '../hooks/useWebSocket';
import { telemetryCache } from '../services/telemetryCache';
import type { TelemetryFrame } from '../types';

interface TelemetryContextValue {
  telemetry: TelemetryFrame | null;
  connected: boolean;
  isFromCache?: boolean;
  cacheTimestamp?: number;
}

const TelemetryContext = createContext<TelemetryContextValue>({
  telemetry: null,
  connected: false,
  isFromCache: false,
});

export const useTelemetry = (): TelemetryContextValue => useContext(TelemetryContext);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wsValue = useWebSocket('ws://127.0.0.1:3000/ws');
  const [cachedFrame, setCachedFrame] = useState<TelemetryFrame | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<number | undefined>();
  const [, setIsInitialized] = useState(false);

  // Initialize cache and load last frame on mount
  useEffect(() => {
    let mounted = true;

    telemetryCache
      .init()
      .then(() => telemetryCache.getLastFrame())
      .then((lastFrame) => {
        if (mounted && lastFrame) {
          console.log('[TelemetryProvider] Loaded cached frame from IndexedDB');
          setCachedFrame(lastFrame);
          setCacheTimestamp(Date.now());
        }
      })
      .catch((error) => {
        console.error('[TelemetryProvider] Failed to load cache:', error);
      })
      .finally(() => {
        if (mounted) {
          setIsInitialized(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Cache new frames when they arrive
  useEffect(() => {
    if (wsValue.telemetry && wsValue.connected) {
      telemetryCache.saveFrame(wsValue.telemetry).catch((error) => {
        console.error('[TelemetryProvider] Failed to cache frame:', error);
      });

      // Clear cached frame when live data arrives
      setCachedFrame(null);
      setCacheTimestamp(undefined);
    }
  }, [wsValue.telemetry, wsValue.connected]);

  // Determine what to show
  const value: TelemetryContextValue = {
    telemetry: wsValue.connected ? wsValue.telemetry : cachedFrame,
    connected: wsValue.connected,
    isFromCache: !wsValue.connected && cachedFrame !== null,
    cacheTimestamp,
  };

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};
