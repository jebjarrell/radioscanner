import { useMemo } from 'react';

import { useTelemetry } from '../../../contexts/TelemetryContext';
import { useUserPosition } from '../../../hooks/useUserPosition';
import { haversineDistance } from '../../../utils/geo';
import { fromTelemetry } from '../adapters';
import type { Aircraft } from '../types';

export const useAircraft = (): Aircraft[] => {
  const { telemetry } = useTelemetry();
  const userPosition = useUserPosition();

  return useMemo(() => {
    if (!telemetry?.aircraft?.length) {
      return [];
    }
    const now = Date.now();
    const { lat: originLat, lon: originLon } = userPosition;

    return telemetry.aircraft
      .map((item) => fromTelemetry(item, now))
      .filter((item): item is Aircraft => item !== null)
      .map((aircraft) => ({
        ...aircraft,
        distance: haversineDistance(originLat, originLon, aircraft.lat, aircraft.lon),
      }));
  }, [telemetry?.aircraft, userPosition]);
};
