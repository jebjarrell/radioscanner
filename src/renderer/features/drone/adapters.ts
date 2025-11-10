import type { TelemetryDrone } from '../../types.js';

import type { Drone } from './types.js';

const toNullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function fromWs(entry: Partial<TelemetryDrone> | null | undefined): Drone {
  const source = entry ?? {};
  const droneId =
    typeof source.droneId === 'string'
      ? source.droneId
      : source.droneId != null
        ? String(source.droneId)
        : 'unknown';

  return {
    droneId,
    manufacturer: typeof source.manufacturer === 'string' ? source.manufacturer : null,
    model: typeof source.model === 'string' ? source.model : null,
    droneLat: toNullableNumber(source.droneLat),
    droneLon: toNullableNumber(source.droneLon),
    droneAltitude: toNullableNumber(source.droneAltitude),
    operatorLat: toNullableNumber(source.operatorLat),
    operatorLon: toNullableNumber(source.operatorLon),
    speed: toNullableNumber(source.speed),
    heading: toNullableNumber(source.heading),
    uaType: typeof source.uaType === 'string' ? source.uaType : null,
    lastSeen:
      typeof source.lastSeen === 'number' && Number.isFinite(source.lastSeen)
        ? source.lastSeen
        : Date.now(),
  };
}
