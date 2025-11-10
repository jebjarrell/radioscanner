import { useMemo } from 'react';

import { useTelemetry } from '../../../contexts/TelemetryContext';
import type { TelemetryDrone } from '../../../types.js';
import { haversineDistance } from '../../../utils/geo';
import { fromWs } from '../adapters.js';
import type { Drone } from '../types.js';

const DEFAULT_POSITION = { lat: 40.7306, lon: -73.9352 };

export const useDrones = (): Drone[] => {
  const { telemetry } = useTelemetry();

  return useMemo(() => {
    const raw: TelemetryDrone[] | undefined = telemetry?.drone.detections;
    if (!raw?.length) {
      return [];
    }

    const userLat = DEFAULT_POSITION.lat;
    const userLon = DEFAULT_POSITION.lon;
    const now = Date.now();

    return raw
      .map((entry) => fromWs(entry))
      .map((drone) => ({
        ...drone,
        lastSeen: drone.lastSeen || now,
        distance:
          drone.operatorLat != null && drone.operatorLon != null
            ? haversineDistance(userLat, userLon, drone.operatorLat, drone.operatorLon)
            : undefined,
      }));
  }, [telemetry]);
};
