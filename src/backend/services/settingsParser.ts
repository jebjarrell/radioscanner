/**
 * Settings Parser
 * Converts flat key-value settings to structured object and vice versa
 */

export interface AppSettings {
  session: {
    storageMode: 'memory' | 'disk';
  };
  services: {
    backendHost: string;
    backendPort: number;
    dump1090Host: string;
    dump1090Port: number;
    kismetHost: string;
    kismetPort: number;
    rtlTcpHost: string;
    rtlTcpPort: number;
    gpsdHost: string;
    gpsdPort: number;
  };
  preferences: {
    distanceUnit: 'miles' | 'kilometers' | 'nautical';
    mapStyle: string;
    mapDefaultCenterLat: number;
    mapDefaultCenterLon: number;
    mapDefaultZoom: number;
  };
  notifications: {
    enabled: boolean;
    droneDetected: boolean;
    aircraftProximity: boolean;
    aircraftProximityThresholdMiles: number;
    newSignal: boolean;
    duration: number;
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  };
  performance: {
    waterfallMaxRows: number;
    maxAircraftDisplayed: number;
    peakDetectionSensitivity: 'low' | 'medium' | 'high';
    telemetryUpdateInterval: number;
  };
}

/**
 * Parse flat key-value settings to structured object
 */
export function parseSettings(flat: Record<string, string>): AppSettings {
  const get = (key: string, fallback: string): string => flat[key] ?? fallback;
  const getNum = (key: string, fallback: number): number => {
    const val = parseFloat(flat[key] ?? '');
    return Number.isFinite(val) ? val : fallback;
  };
  const getBool = (key: string, fallback: boolean): boolean => {
    const val = (flat[key] ?? '').toLowerCase();
    if (val === 'true' || val === '1') return true;
    if (val === 'false' || val === '0') return false;
    return fallback;
  };

  return {
    session: {
      storageMode: (get('session.storageMode', 'memory') === 'disk' ? 'disk' : 'memory') as
        | 'memory'
        | 'disk',
    },
    services: {
      backendHost: get('services.backendHost', '127.0.0.1'),
      backendPort: getNum('services.backendPort', 3000),
      dump1090Host: get('services.dump1090Host', '127.0.0.1'),
      dump1090Port: getNum('services.dump1090Port', 8080),
      kismetHost: get('services.kismetHost', '127.0.0.1'),
      kismetPort: getNum('services.kismetPort', 2501),
      rtlTcpHost: get('services.rtlTcpHost', '127.0.0.1'),
      rtlTcpPort: getNum('services.rtlTcpPort', 1234),
      gpsdHost: get('services.gpsdHost', '127.0.0.1'),
      gpsdPort: getNum('services.gpsdPort', 2947),
    },
    preferences: {
      distanceUnit: (get('preferences.distanceUnit', 'miles') as
        | 'miles'
        | 'kilometers'
        | 'nautical') || 'miles',
      mapStyle: get('preferences.mapStyle', 'demotiles'),
      mapDefaultCenterLat: getNum('preferences.mapDefaultCenterLat', 40.7306),
      mapDefaultCenterLon: getNum('preferences.mapDefaultCenterLon', -73.9352),
      mapDefaultZoom: getNum('preferences.mapDefaultZoom', 9.5),
    },
    notifications: {
      enabled: getBool('notifications.enabled', true),
      droneDetected: getBool('notifications.droneDetected', true),
      aircraftProximity: getBool('notifications.aircraftProximity', false),
      aircraftProximityThresholdMiles: getNum('notifications.aircraftProximityThresholdMiles', 5),
      newSignal: getBool('notifications.newSignal', true),
      duration: getNum('notifications.duration', 4000),
      position: (get('notifications.position', 'top-right') as
        | 'top-right'
        | 'top-left'
        | 'bottom-right'
        | 'bottom-left') || 'top-right',
    },
    performance: {
      waterfallMaxRows: getNum('performance.waterfallMaxRows', 100),
      maxAircraftDisplayed: getNum('performance.maxAircraftDisplayed', 200),
      peakDetectionSensitivity: (get('performance.peakDetectionSensitivity', 'medium') as
        | 'low'
        | 'medium'
        | 'high') || 'medium',
      telemetryUpdateInterval: getNum('performance.telemetryUpdateInterval', 1000),
    },
  };
}

/**
 * Check if settings changes require application restart
 */
export function requiresRestart(updates: Array<{ key: string; value: string }>): boolean {
  const restartKeys = [
    'services.backendHost',
    'services.backendPort',
    'services.dump1090Host',
    'services.dump1090Port',
    'services.kismetHost',
    'services.kismetPort',
    'services.rtlTcpHost',
    'services.rtlTcpPort',
    'services.gpsdHost',
    'services.gpsdPort',
    'session.storageMode',
  ];

  return updates.some((update) => restartKeys.includes(update.key));
}
