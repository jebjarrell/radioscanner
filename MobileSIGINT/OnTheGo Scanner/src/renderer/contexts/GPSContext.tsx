import React, { createContext, useContext, useMemo } from 'react';

import { useTelemetry } from './TelemetryContext';

export interface GPSPosition {
  lat: number;
  lon: number;
  alt?: number;
  timestamp: number;
}

interface GPSContextValue {
  position: GPSPosition | null;
  connected: boolean;
}

const GPSContext = createContext<GPSContextValue>({
  position: null,
  connected: false,
});

export const useGPS = (): GPSContextValue => useContext(GPSContext);

export const GPSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { telemetry } = useTelemetry();

  const value = useMemo<GPSContextValue>(() => {
    const gpsStatus = telemetry?.health?.gps;

    if (!gpsStatus) {
      return { position: null, connected: false };
    }

    const position = gpsStatus.lastFix
      ? {
          lat: gpsStatus.lastFix.lat,
          lon: gpsStatus.lastFix.lon,
          alt: gpsStatus.lastFix.alt,
          timestamp: gpsStatus.lastFix.timestamp,
        }
      : null;

    return {
      position,
      connected: gpsStatus.connected,
    };
  }, [telemetry?.health?.gps]);

  return <GPSContext.Provider value={value}>{children}</GPSContext.Provider>;
};
