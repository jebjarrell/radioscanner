/**
 * Bluetooth Remote ID Client
 *
 * Scans for ASTM F3411 compliant drones broadcasting Remote ID via Bluetooth Low Energy.
 * Complements the Kismet Wi-Fi detection to provide comprehensive drone detection.
 *
 * Requires:
 * - Linux: BlueZ (user in 'bluetooth' group)
 * - macOS: Core Bluetooth (built-in)
 * - Windows: noble-winrt
 *
 * @see https://www.astm.org/f3411-22a.html
 */

import type { Peripheral } from '@abandonware/noble';

import {
  AstmF3411Parser,
  type AstmBasicId,
  type AstmLocation,
  type AstmMessage,
  type AstmSystem,
  MessageType,
  UaType,
} from './astmParser.js';
import type { RemoteIdPayload } from './kismetRid.js';

// ASTM Remote ID service UUID
const REMOTE_ID_SERVICE_UUID = 'fffa';

// Human-readable UA type names, indexed by the ASTM UAType enum value
const UA_TYPE_NAMES: Record<UaType, string> = {
  [UaType.NONE]: 'Unknown',
  [UaType.AEROPLANE]: 'Aeroplane',
  [UaType.HELICOPTER_OR_MULTIROTOR]: 'Helicopter/Multirotor',
  [UaType.GYROPLANE]: 'Gyroplane',
  [UaType.HYBRID_LIFT]: 'Hybrid Lift',
  [UaType.ORNITHOPTER]: 'Ornithopter',
  [UaType.GLIDER]: 'Glider',
  [UaType.KITE]: 'Kite',
  [UaType.FREE_BALLOON]: 'Free Balloon',
  [UaType.CAPTIVE_BALLOON]: 'Captive Balloon',
  [UaType.AIRSHIP]: 'Airship',
  [UaType.FREE_FALL_PARACHUTE]: 'Free Fall/Parachute',
  [UaType.ROCKET]: 'Rocket',
  [UaType.TETHERED_POWERED_AIRCRAFT]: 'Tethered Powered Aircraft',
  [UaType.GROUND_OBSTACLE]: 'Ground Obstacle',
  [UaType.OTHER]: 'Other',
};

// Drone data aggregated from multiple message types
interface DroneData {
  address: string;
  droneId?: string;
  manufacturer?: string;
  uaType?: UaType;
  droneLat?: number;
  droneLon?: number;
  droneAltitude?: number;
  operatorLat?: number;
  operatorLon?: number;
  operatorAltitude?: number;
  speed?: number;
  heading?: number;
  lastSeen: number;
  messages: {
    basicId?: AstmBasicId;
    location?: AstmLocation;
    system?: AstmSystem;
  };
}

export class BluetoothRidClient {
  private scanning = false;
  private drones = new Map<string, DroneData>();
  private noble: typeof import('@abandonware/noble') | null = null;
  private readonly staleTimeout = 30000; // 30 seconds
  private cleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Start scanning for Bluetooth Remote ID broadcasts
   * Gracefully handles noble initialization failures
   */
  async start(): Promise<void> {
    if (this.scanning) {
      return;
    }

    // Windows platform notification
    if (process.platform === 'win32') {
      console.log(
        '[BluetoothRidClient] Windows detected - ensure Bluetooth adapter configured with Zadig (WinUSB driver)',
      );
    }

    try {
      // Dynamically import noble (may fail if Bluetooth not available). noble is
      // an optional native dependency that may not be installed, so its module
      // path is intentionally unresolved at lint time.
      // eslint-disable-next-line import/no-unresolved
      this.noble = await import('@abandonware/noble');

      // Set up event handlers
      this.noble.on('stateChange', (state: string) => {
        this.handleStateChange(state);
      });

      this.noble.on('discover', (peripheral: Peripheral) => {
        this.handleDiscovery(peripheral);
      });

      // Start cleanup timer
      this.cleanupTimer = setInterval(() => this.cleanupStale(), 10000);

      console.log('[BluetoothRidClient] Initialized - waiting for Bluetooth to power on');
    } catch (error) {
      console.warn('[BluetoothRidClient] Failed to initialize Bluetooth:', error);
      if (process.platform === 'win32') {
        console.warn(
          '[BluetoothRidClient] Windows requires: (1) windows-build-tools, (2) WinUSB driver via Zadig',
        );
        console.warn('[BluetoothRidClient] See WINDOWS_SETUP.md for detailed instructions');
      }
      // Graceful degradation - continue without Bluetooth
    }
  }

  /**
   * Stop scanning and cleanup
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.noble && this.scanning) {
      try {
        this.noble.stopScanning();
        this.noble.removeAllListeners();
      } catch (error) {
        console.error('[BluetoothRidClient] Error stopping scan:', error);
      }
    }

    this.scanning = false;
    this.drones.clear();
    this.noble = null;
  }

  /**
   * Get current drone detections
   * Returns array of RemoteIdPayload compatible with Kismet detections
   */
  getDetections(): RemoteIdPayload[] {
    const detections: RemoteIdPayload[] = [];

    for (const drone of this.drones.values()) {
      // Only include drones with valid Basic ID
      if (!drone.droneId) {
        continue;
      }

      detections.push({
        droneId: drone.droneId,
        manufacturer: drone.manufacturer || null,
        model: null, // Not available in ASTM F3411
        droneLat: drone.droneLat ?? null,
        droneLon: drone.droneLon ?? null,
        droneAltitude: drone.droneAltitude ?? null,
        operatorLat: drone.operatorLat ?? null,
        operatorLon: drone.operatorLon ?? null,
        speed: drone.speed ?? null,
        heading: drone.heading ?? null,
        uaType: drone.uaType !== undefined ? (UA_TYPE_NAMES[drone.uaType] ?? null) : null,
        lastSeen: drone.lastSeen,
      });
    }

    return detections;
  }

  /**
   * Handle noble state changes
   */
  private handleStateChange(state: string): void {
    console.log(`[BluetoothRidClient] Bluetooth state: ${state}`);

    if (state === 'poweredOn') {
      void this.startScanning();
    } else {
      if (this.noble && this.scanning) {
        this.noble.stopScanning();
        this.scanning = false;
      }
    }
  }

  /**
   * Start BLE scanning for Remote ID service
   */
  private async startScanning(): Promise<void> {
    if (!this.noble || this.scanning) {
      return;
    }

    try {
      // Scan for Remote ID service UUID
      // allowDuplicates=true to get continuous updates
      await this.noble.startScanningAsync([REMOTE_ID_SERVICE_UUID], true);
      this.scanning = true;
      console.log('[BluetoothRidClient] Scanning for Remote ID broadcasts...');
    } catch (error) {
      console.error('[BluetoothRidClient] Failed to start scanning:', error);
      this.scanning = false;
    }
  }

  /**
   * Handle BLE peripheral discovery
   */
  private handleDiscovery(peripheral: Peripheral): void {
    const { address, advertisement } = peripheral;

    if (!advertisement || !advertisement.serviceData) {
      return;
    }

    // Look for Remote ID service data
    for (const service of advertisement.serviceData) {
      if (service.uuid.toLowerCase() === REMOTE_ID_SERVICE_UUID) {
        this.ingestServiceData(address, service.data);
      }
    }
  }

  /**
   * Ingest raw 0xFFFA service data from a BLE advertisement.
   *
   * Handles the ASTM BLE prefix (0x0D application code + message counter),
   * single messages, and BT5 Message Packs. Public so tests and simulators
   * can feed advertisements without a Bluetooth adapter.
   */
  ingestServiceData(address: string, data: Buffer): void {
    try {
      const messages = AstmF3411Parser.parseAdvertisement(data);
      for (const message of messages) {
        this.processMessage(address, message);
      }
    } catch (error) {
      console.warn('[BluetoothRidClient] Failed to parse advertisement:', error);
    }
  }

  /**
   * Process a parsed ASTM message and update drone data
   */
  private processMessage(address: string, message: AstmMessage): void {
    // Get or create drone data
    let drone = this.drones.get(address);
    if (!drone) {
      drone = {
        address,
        lastSeen: Date.now(),
        messages: {},
      };
      this.drones.set(address, drone);
    }

    drone.lastSeen = Date.now();

    // Update drone data based on message type
    switch (message.messageType) {
      case MessageType.BASIC_ID:
        this.processBasicId(drone, message);
        break;

      case MessageType.LOCATION_VECTOR:
        this.processLocation(drone, message);
        break;

      case MessageType.SYSTEM:
        this.processSystem(drone, message);
        break;

      // Other message types (Self-ID, Operator ID, Authentication)
      // are informational and don't affect core drone data
      default:
        break;
    }
  }

  /**
   * Process Basic ID message
   */
  private processBasicId(drone: DroneData, message: AstmBasicId): void {
    drone.messages.basicId = message;
    drone.droneId = message.uasId;
    drone.uaType = message.uaType;

    // Try to identify manufacturer from ID
    if (message.uasId.toUpperCase().startsWith('DJI')) {
      drone.manufacturer = 'DJI';
    } else if (message.uasId.toUpperCase().startsWith('AUTEL')) {
      drone.manufacturer = 'Autel';
    } else if (message.uasId.toUpperCase().startsWith('PARROT')) {
      drone.manufacturer = 'Parrot';
    }
  }

  /**
   * Process Location/Vector message
   */
  private processLocation(drone: DroneData, message: AstmLocation): void {
    drone.messages.location = message;
    drone.droneLat = message.latitude;
    drone.droneLon = message.longitude;
    // Prefer geodetic (WGS84) altitude; fall back to pressure altitude
    drone.droneAltitude = message.altitudeWgs84 ?? message.altitudeBaro ?? undefined;
    drone.speed = message.speedHorizontal;
    drone.heading = message.direction ?? undefined;
  }

  /**
   * Process System message
   */
  private processSystem(drone: DroneData, message: AstmSystem): void {
    drone.messages.system = message;
    drone.operatorLat = message.operatorLatitude;
    drone.operatorLon = message.operatorLongitude;
    drone.operatorAltitude = message.operatorAltitude ?? undefined;
  }

  /**
   * Remove stale drone detections.
   * Runs on a timer while scanning; public for direct use in tests.
   */
  cleanupStale(): void {
    const now = Date.now();
    const addresses = Array.from(this.drones.keys());

    for (const address of addresses) {
      const drone = this.drones.get(address);
      if (drone && now - drone.lastSeen > this.staleTimeout) {
        this.drones.delete(address);
      }
    }
  }
}
