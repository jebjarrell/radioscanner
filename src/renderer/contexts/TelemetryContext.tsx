import React, { createContext, useContext } from 'react';

import { useWebSocket } from '../hooks/useWebSocket';
import type { TelemetryFrame } from '../types';
import { WEBSOCKET_URL } from '../../config/client.js';

interface TelemetryContextValue {
  telemetry: TelemetryFrame | null;
  connected: boolean;
}

const TelemetryContext = createContext<TelemetryContextValue>({
  telemetry: null,
  connected: false,
});

export const useTelemetry = (): TelemetryContextValue => useContext(TelemetryContext);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useWebSocket(WEBSOCKET_URL);

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};
