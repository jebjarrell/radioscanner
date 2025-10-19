import React, { createContext, useContext } from 'react';

import { useWebSocket } from '../hooks/useWebSocket';
import type { TelemetryFrame } from '../types';

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
  const value = useWebSocket('ws://127.0.0.1:3000/ws');

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};
