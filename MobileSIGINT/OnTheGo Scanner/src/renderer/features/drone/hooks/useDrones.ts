import { useMemo } from 'react';

import { useTelemetry } from '../../../contexts/TelemetryContext';
import { useUserPosition } from '../../../hooks/useUserPosition';
import type { TelemetryDrone } from '../../../types.js';
import { haversineDistance } from '../../../utils/geo';
import { fromWs } from '../adapters.js';
import type { Drone } from '../types.js';

export const useDrones = (): Drone[] => {
  const { telemetry } = useTelemetry();
  const userPosition = useUserPosition();

  return useMemo(() => {
    const raw: TelemetryDrone[] | undefined = telemetry?.drone.detections;
    if (!raw?.length) {
      return [];
    }

    const { lat: userLat, lon: userLon } = userPosition;
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
  }, [telemetry, userPosition]);
};
