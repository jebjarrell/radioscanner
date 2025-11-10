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

export interface TelemetryDrone {
  droneId?: string;
  manufacturer?: string | null;
  model?: string | null;
  droneLat?: number | null;
  droneLon?: number | null;
  droneAltitude?: number | null;
  operatorLat?: number | null;
  operatorLon?: number | null;
  speed?: number | null;
  heading?: number | null;
  uaType?: string | null;
  lastSeen?: number;
  [key: string]: unknown;
}

export interface TelemetryFrame {
  timestamp: string;
  health: TelemetryHealthSnapshot;
  aircraft: TelemetryAircraft[];
  drone: {
    ridAvailable: boolean;
    detections: TelemetryDrone[];
  };
  signals: {
    rtlTcpConnected: boolean;
    gpsConnected: boolean;
  };
}
