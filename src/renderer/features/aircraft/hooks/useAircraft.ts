import { useMemo } from 'react';

import { useTelemetry } from '../../../contexts/TelemetryContext';
import { haversineDistance } from '../../../utils/geo';
import { fromTelemetry } from '../adapters';
import type { Aircraft } from '../types';

const DEFAULT_POSITION = {
  lat: 40.7306,
  lon: -73.9352,
};

export const useAircraft = (): Aircraft[] => {
  const { telemetry } = useTelemetry();

  return useMemo(() => {
    if (!telemetry?.aircraft?.length) {
      return [];
    }
    const now = Date.now();
    const { lat: originLat, lon: originLon } = DEFAULT_POSITION;

    return telemetry.aircraft
      .map((item) => fromTelemetry(item, now))
      .filter((item): item is Aircraft => item !== null)
      .map((aircraft) => ({
        ...aircraft,
        distance: haversineDistance(originLat, originLon, aircraft.lat, aircraft.lon),
      }));
  }, [telemetry?.aircraft]);
};
