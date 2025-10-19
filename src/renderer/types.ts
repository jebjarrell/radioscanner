export interface TelemetryHealthSnapshot {
  rtlTcp: {
    connected: boolean;
    banner?: string;
    lastError?: string;
    lastConnectedAt?: number;
  };
  dump1090: {
    healthy: boolean;
    lastError?: string;
    lastUpdated?: number;
  };
  kismet: {
    available: boolean;
    ridEnabled: boolean;
    lastChecked?: number;
    lastError?: string;
  };
  gps: {
    connected: boolean;
    lastError?: string;
    lastFix?: {
      lat: number;
      lon: number;
      alt?: number;
      timestamp: number;
    } | null;
    lastChecked?: number;
  };
  timestamp: number;
}

export interface TelemetryAircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number;
  seen?: number;
  [key: string]: unknown;
}

export interface TelemetryFrame {
  timestamp: string;
  health: TelemetryHealthSnapshot;
  aircraft: TelemetryAircraft[];
  drone: {
    ridAvailable: boolean;
  };
  signals: {
    rtlTcpConnected: boolean;
    gpsConnected: boolean;
  };
}
