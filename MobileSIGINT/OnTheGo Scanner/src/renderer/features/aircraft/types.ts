export interface Aircraft {
  icao: string;
  callsign: string;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number;
  verticalRate: number | null;
  squawk: string | null;
  lastSeen: number;
  distance?: number;
}

export type SortKey = 'callsign' | 'distance' | 'altitude' | 'speed';
export type SortDirection = 'asc' | 'desc';
