import { useMemo } from 'react';

import { useSettings } from './useSettings';

export interface Position {
  lat: number;
  lon: number;
}

/**
 * Hook to get user's current position
 * Priority: GPS position (future) > Settings default > NYC fallback
 */
export function useUserPosition(): Position {
  const { settings } = useSettings();

  return useMemo(() => {
    // TODO: Add GPS position support when GPS context is implemented
    // const gpsPosition = useGPS();
    // if (gpsPosition) return gpsPosition;

    // Use settings-configured default position
    const lat = settings?.preferences?.mapDefaultCenterLat ?? 40.7306;
    const lon = settings?.preferences?.mapDefaultCenterLon ?? -73.9352;

    return { lat, lon };
  }, [settings?.preferences?.mapDefaultCenterLat, settings?.preferences?.mapDefaultCenterLon]);
}
