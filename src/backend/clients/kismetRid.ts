export type RemoteIdPayload = {
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
  uaType: string | null;
  lastSeen: number;
};

export class KismetRidClient {
  constructor(private readonly baseUrl = 'http://127.0.0.1:2501') {}

  // Phase 5.5: implement Kismet polling + ASTM F3411 parsing.
  async fetchRemoteId(): Promise<RemoteIdPayload[]> {
    return [];
  }
}
