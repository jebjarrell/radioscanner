import { KISMET_CONFIG } from '../../config/index.js';

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

/**
 * Kismet UAV device structure from /phy/phyuav/devices.json
 * Based on Kismet's UAV detection API
 */
interface KismetUavDevice {
  'kismet.device.base.key': string;
  'kismet.device.base.macaddr': string;
  'kismet.device.base.name'?: string;
  'kismet.device.base.manuf'?: string;
  'kismet.device.base.type'?: string;
  'uav.manufacturer'?: string;
  'uav.model'?: string;
  'uav.serialnumber'?: string;
  'uav.id'?: string;
  'kismet.device.base.location'?: {
    'kismet.common.location.avg_lat': number;
    'kismet.common.location.avg_lon': number;
    'kismet.common.location.avg_alt': number;
  };
  'kismet.device.base.last_time'?: number;
}

export class KismetRidClient {
  private readonly uavDevicesUrl: string;
  private readonly fetchTimeout = 2000; // 2 second timeout

  constructor(private readonly baseUrl = KISMET_CONFIG.baseUrl) {
    // Kismet UAV devices endpoint
    this.uavDevicesUrl = `${this.baseUrl}/phy/phyuav/devices.json`;
  }

  /**
   * Fetch drone detections from Kismet's UAV API
   * Uses Kismet's Wi-Fi based drone detection (primarily DJI drones)
   * Returns empty array on error to allow graceful degradation
   */
  async fetchRemoteId(): Promise<RemoteIdPayload[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.fetchTimeout);

      const response = await fetch(this.uavDevicesUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`Kismet UAV API returned status ${response.status}`);
        return [];
      }

      const devices = (await response.json()) as KismetUavDevice[];

      if (!Array.isArray(devices)) {
        console.warn('Kismet UAV API returned non-array response');
        return [];
      }

      return devices
        .filter((device) => this.isValidUavDevice(device))
        .map((device) => this.mapToRemoteIdPayload(device));
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.warn('Kismet UAV API request timeout');
        } else {
          console.error('Kismet UAV API error:', error.message);
        }
      } else {
        console.error('Kismet UAV API unknown error:', error);
      }
      return [];
    }
  }

  /**
   * Validate that device has required UAV fields
   */
  private isValidUavDevice(device: KismetUavDevice): boolean {
    // Must have either UAV serial number or ID
    return !!(device['uav.serialnumber'] || device['uav.id']);
  }

  /**
   * Map Kismet UAV device to RemoteIdPayload
   */
  private mapToRemoteIdPayload(device: KismetUavDevice): RemoteIdPayload {
    const location = device['kismet.device.base.location'];
    const lat = location?.['kismet.common.location.avg_lat'] ?? null;
    const lon = location?.['kismet.common.location.avg_lon'] ?? null;
    const altitude = location?.['kismet.common.location.avg_alt'] ?? null;

    // Validate coordinates if present
    const validLat = lat !== null && lat >= -90 && lat <= 90 ? lat : null;
    const validLon = lon !== null && lon >= -180 && lon <= 180 ? lon : null;

    return {
      droneId:
        device['uav.serialnumber'] ||
        device['uav.id'] ||
        device['kismet.device.base.macaddr'] ||
        'unknown',
      manufacturer: device['uav.manufacturer'] || device['kismet.device.base.manuf'] || null,
      model: device['uav.model'] || null,
      droneLat: validLat,
      droneLon: validLon,
      droneAltitude: altitude,
      operatorLat: null, // Not available in Wi-Fi detection
      operatorLon: null, // Not available in Wi-Fi detection
      speed: null, // Not available in Kismet UAV data
      heading: null, // Not available in Kismet UAV data
      uaType: device['kismet.device.base.type'] || null,
      lastSeen: device['kismet.device.base.last_time'] || Date.now(),
    };
  }
}
