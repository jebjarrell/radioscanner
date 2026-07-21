export interface Drone {
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
  uaType?: string | null;
  lastSeen: number;
  distance?: number;
}

export type DroneSortKey = 'droneId' | 'distance' | 'manufacturer' | 'altitude';
export type SortDirection = 'asc' | 'desc';
