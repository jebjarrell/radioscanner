import { useMemo } from 'react';

import { useGPS } from '../contexts/GPSContext';

import { useSettings } from './useSettings';

export interface Position {
  lat: number;
  lon: number;
}

/**
 * Hook to get user's current position
 * Priority: GPS position > Settings default > NYC fallback
 */
export function useUserPosition(): Position {
  const { position: gpsPosition } = useGPS();
  const { settings } = useSettings();

  return useMemo(() => {
    // Use real GPS position if available
    if (gpsPosition && typeof gpsPosition.lat === 'number' && typeof gpsPosition.lon === 'number') {
      return { lat: gpsPosition.lat, lon: gpsPosition.lon };
    }

    // Fall back to settings-configured default position
    const lat = settings?.preferences?.mapDefaultCenterLat ?? 40.7306;
    const lon = settings?.preferences?.mapDefaultCenterLon ?? -73.9352;

    return { lat, lon };
  }, [
    gpsPosition,
    settings?.preferences?.mapDefaultCenterLat,
    settings?.preferences?.mapDefaultCenterLon,
  ]);
}
