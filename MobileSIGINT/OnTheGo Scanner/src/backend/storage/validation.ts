export const ICAO = /^[a-f0-9]{6}$/i;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export type AircraftRecord = {
  ts: number;
  icao: string;
  callsign: string | null;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number;
  verticalRate: number | null;
  squawk: string | null;
};

export type DroneRecord = {
  ts: number;
  droneId: string;
  manufacturer: string | null;
  model: string | null;
  droneLat: number | null;
  droneLon: number | null;
  droneAltitude: number | null;
  operatorLat: number | null;
  operatorLon: number | null;
  speed: number | null;
  heading: number | null;
};

export type SignalRecord = {
  ts: number;
  frequency: number;
  signalStrength: number;
  bandwidth: number;
  deviceLat: number | null;
  deviceLon: number | null;
};

export function validateAircraft(record: AircraftRecord): AircraftRecord | null {
  if (!ICAO.test(record.icao)) {
    return null;
  }
  if (!Number.isFinite(record.lat) || !Number.isFinite(record.lon)) {
    return null;
  }

  const altitude = Number.isFinite(record.altitude) ? Math.round(record.altitude) : 0;
  const speed = Number.isFinite(record.speed) ? Math.round(record.speed) : 0;
  const heading = Number.isFinite(record.heading) ? Math.round(record.heading) : 0;

  return {
    ...record,
    lat: clamp(record.lat, -90, 90),
    lon: clamp(record.lon, -180, 180),
    altitude: clamp(altitude, 0, 60_000),
    speed: clamp(speed, 0, 1_000),
    heading: clamp(heading, 0, 359),
    verticalRate:
      record.verticalRate !== null && Number.isFinite(record.verticalRate)
        ? Math.round(record.verticalRate)
        : null,
  };
}

export function validateDrone(record: DroneRecord): DroneRecord | null {
  if (!record.droneId) {
    return null;
  }
  const normalize = (value: number | null, min: number, max: number) => {
    if (value === null || !Number.isFinite(value)) return null;
    return clamp(value, min, max);
  };
  return {
    ...record,
    droneLat: normalize(record.droneLat, -90, 90),
    droneLon: normalize(record.droneLon, -180, 180),
    droneAltitude: normalize(record.droneAltitude, -1_500, 60_000),
    operatorLat: normalize(record.operatorLat, -90, 90),
    operatorLon: normalize(record.operatorLon, -180, 180),
    speed:
      record.speed === null || !Number.isFinite(record.speed)
        ? null
        : clamp(Math.round(record.speed), 0, 500),
    heading:
      record.heading === null || !Number.isFinite(record.heading)
        ? null
        : clamp(Math.round(record.heading), 0, 359),
  };
}

export function validateSignal(record: SignalRecord): SignalRecord | null {
  if (!Number.isFinite(record.frequency) || !Number.isFinite(record.signalStrength)) {
    return null;
  }
  const normalize = (value: number | null, min: number, max: number) => {
    if (value === null || !Number.isFinite(value)) return null;
    return clamp(value, min, max);
  };
  return {
    ...record,
    deviceLat: normalize(record.deviceLat, -90, 90),
    deviceLon: normalize(record.deviceLon, -180, 180),
  };
}
