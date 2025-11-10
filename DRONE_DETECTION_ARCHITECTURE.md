# Real Drone Detection Architecture

## Executive Summary

This document outlines the architecture for implementing real drone detection in the OnTheGo Scanner application. Based on research into Kismet's actual capabilities and ASTM F3411 standards, we implement a phased approach.

## Research Findings

### Kismet UAV Detection Capabilities

**What Kismet Actually Supports:**
- ✅ UAV/Drone detection via Wi-Fi (DJI DroneID in beacon frames)
- ✅ Device classification by SSID patterns and MAC addresses
- ✅ REST API endpoint: `/phy/phyuav...` or device views API
- ✅ Detection of DJI drones (most common commercial drones)
- ⚠️ Bluetooth scanning (active scan, not passive ASTM F3411 parsing)
- ❌ Native ASTM F3411 Bluetooth Remote ID parsing (NOT supported)

**API Documentation:**
- **UAV Endpoint**: `https://www.kismetwireless.net/docs/api/uav_drone/`
- **Devices Endpoint**: `https://www.kismetwireless.net/docs/api/devices/`

### ASTM F3411 Remote ID Standard

**What F3411 Defines:**
- Bluetooth Low Energy broadcasts from drones
- Service UUID: `0xFFFA` (ASTM Remote ID)
- Message Types:
  - **0x0**: Basic ID (UAS identifier - serial number)
  - **0x1**: Location/Vector (position, altitude, speed, heading)
  - **0x2**: Authentication (optional)
  - **0x3**: Self-ID (operator text description)
  - **0x4**: System (operator location, timestamp)
  - **0x5**: Operator ID (operator registration number)

**Implementation Libraries:**
- **opendroneid-core-c**: C library for parsing (NO Node.js bindings)
- **python-odid**: Python implementation
- **flutter_opendroneid**: Flutter implementation

## Architectural Decision

### Phase 1: Kismet Wi-Fi UAV Detection (IMPLEMENT NOW)

**Rationale:**
- Kismet already has proven UAV detection for DJI drones
- DJI dominates consumer/commercial drone market (~70% market share)
- Uses existing infrastructure (Kismet already configured)
- Simpler implementation with immediate value

**Capabilities:**
- Detect DJI drones broadcasting DroneID via Wi-Fi
- Extract manufacturer, model, serial number
- Real-time detection without additional hardware

**Limitations:**
- Only detects drones actively broadcasting Wi-Fi
- Primarily DJI drones (other manufacturers may not be detected)
- No operator location information
- Less comprehensive than ASTM F3411 Bluetooth

### Phase 2: ASTM F3411 Bluetooth (FUTURE ENHANCEMENT)

**Requirements:**
- Node.js Bluetooth library (noble, @abandonware/noble, noble-mac)
- Manual ASTM F3411 message parsing OR
- Node.js bindings for opendroneid-core-c (via node-ffi-napi or N-API)
- Bluetooth adapter capable of passive BLE scanning

**Capabilities:**
- Full ASTM F3411 compliance
- Detect all compliant drones (DJI, Autel, Parrot, etc.)
- Operator location information
- Standardized remote identification

**Complexity:**
- Requires additional npm dependencies
- Complex binary protocol parsing
- More resource intensive
- Bluetooth hardware requirements

## Phase 1 Implementation Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                    HealthMonitor                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  buildTelemetryFrame()                           │   │
│  │    ├─ Call kismetRidClient.fetchRemoteId()      │   │
│  │    ├─ Map to RemoteIdPayload[]                   │   │
│  │    └─ Include in telemetry.drone.detections     │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  KismetRidClient                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  async fetchRemoteId(): Promise<RemoteIdPayload[]>│  │
│  │    1. GET ${baseUrl}/phy/phyuav/devices.json     │   │
│  │    2. Filter for UAV devices                     │   │
│  │    3. Parse device records                       │   │
│  │    4. Extract drone information                  │   │
│  │    5. Map to RemoteIdPayload                     │   │
│  │    6. Return drone array                         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Kismet Server                           │
│                  (External Service)                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  REST API: http://127.0.0.1:2501                 │   │
│  │    └─ /phy/phyuav/devices.json                   │   │
│  │                                                   │   │
│  │  Wi-Fi Monitoring:                               │   │
│  │    └─ Detects DJI DroneID in beacon frames       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Kismet UAV API Data Structure

Based on Kismet's UAV detection, devices will have a `uav` record in their device data:

```typescript
interface KismetUavDevice {
  'kismet.device.base.key': string;
  'kismet.device.base.macaddr': string;
  'kismet.device.base.name': string;
  'kismet.device.base.type': string;
  'kismet.device.base.manuf': string;
  'uav.manufacturer'?: string;
  'uav.model'?: string;
  'uav.serialnumber'?: string;
  'uav.id'?: string;
  'kismet.device.base.signal': {
    'kismet.common.signal.last_signal': number;
  };
  'kismet.device.base.location'?: {
    'kismet.common.location.avg_lat': number;
    'kismet.common.location.avg_lon': number;
    'kismet.common.location.avg_alt': number;
  };
}
```

### Mapping to RemoteIdPayload

```typescript
export interface RemoteIdPayload {
  droneId: string;              // From uav.serialnumber or uav.id
  manufacturer: string | null;   // From uav.manufacturer
  model: string | null;          // From uav.model
  droneLat: number | null;       // From location.avg_lat
  droneLon: number | null;       // From location.avg_lon
  droneAltitude: number | null;  // From location.avg_alt
  operatorLat: number | null;    // NULL (not available in Wi-Fi detection)
  operatorLon: number | null;    // NULL
  operatorAltitude: number | null; // NULL
  speed: number | null;          // NULL (not in Kismet UAV data)
  heading: number | null;        // NULL
  heightAgl: number | null;      // NULL
  timestampAccuracy: number | null; // NULL
}
```

### Implementation Steps

#### 1. Update `src/backend/clients/kismetRid.ts`

```typescript
import { KISMET_CONFIG } from '../config/index.js';

export interface RemoteIdPayload {
  droneId: string;
  manufacturer: string | null;
  model: string | null;
  droneLat: number | null;
  droneLon: number | null;
  droneAltitude: number | null;
  operatorLat: number | null;
  operatorLon: number | null;
  operatorAltitude: number | null;
  speed: number | null;
  heading: number | null;
  heightAgl: number | null;
  timestampAccuracy: number | null;
}

interface KismetUavDevice {
  'kismet.device.base.key': string;
  'kismet.device.base.macaddr': string;
  'kismet.device.base.name'?: string;
  'kismet.device.base.manuf'?: string;
  'uav.manufacturer'?: string;
  'uav.model'?: string;
  'uav.serialnumber'?: string;
  'uav.id'?: string;
  'kismet.device.base.location'?: {
    'kismet.common.location.avg_lat': number;
    'kismet.common.location.avg_lon': number;
    'kismet.common.location.avg_alt': number;
  };
}

export class KismetRidClient {
  private readonly uavDevicesUrl: string;

  constructor(private readonly baseUrl = KISMET_CONFIG.baseUrl) {
    // Kismet UAV devices endpoint
    this.uavDevicesUrl = `${this.baseUrl}/phy/phyuav/devices.json`;
  }

  async fetchRemoteId(): Promise<RemoteIdPayload[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(this.uavDevicesUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`Kismet UAV API returned ${response.status}`);
        return [];
      }

      const devices = (await response.json()) as KismetUavDevice[];

      return devices
        .filter((device) => this.isValidUavDevice(device))
        .map((device) => this.mapToRemoteIdPayload(device));
    } catch (error) {
      console.error('Failed to fetch Kismet UAV devices:', error);
      return [];
    }
  }

  private isValidUavDevice(device: KismetUavDevice): boolean {
    // Must have either UAV serial number or ID
    return !!(device['uav.serialnumber'] || device['uav.id']);
  }

  private mapToRemoteIdPayload(device: KismetUavDevice): RemoteIdPayload {
    const location = device['kismet.device.base.location'];

    return {
      droneId: device['uav.serialnumber'] || device['uav.id'] || device['kismet.device.base.macaddr'],
      manufacturer: device['uav.manufacturer'] || device['kismet.device.base.manuf'] || null,
      model: device['uav.model'] || null,
      droneLat: location?.['kismet.common.location.avg_lat'] ?? null,
      droneLon: location?.['kismet.common.location.avg_lon'] ?? null,
      droneAltitude: location?.['kismet.common.location.avg_alt'] ?? null,
      operatorLat: null, // Not available in Wi-Fi detection
      operatorLon: null,
      operatorAltitude: null,
      speed: null,
      heading: null,
      heightAgl: null,
      timestampAccuracy: null,
    };
  }
}
```

#### 2. Update `src/backend/health.ts`

In the `buildTelemetryFrame()` method around line 310:

```typescript
// Replace existing stub logic
const droneDetections = await this.kismetRidClient.fetchRemoteId();

telemetry.drone = {
  ridAvailable: this.kismetClient.getStatus().ridEnabled,
  detections: droneDetections,
};
```

#### 3. Update Frontend Type Definitions

Ensure `src/renderer/types.ts` has the complete `RemoteIdPayload` type:

```typescript
export interface RemoteIdPayload {
  droneId: string;
  manufacturer: string | null;
  model: string | null;
  droneLat: number | null;
  droneLon: number | null;
  droneAltitude: number | null;
  operatorLat: number | null;
  operatorLon: number | null;
  operatorAltitude: number | null;
  speed: number | null;
  heading: number | null;
  heightAgl: number | null;
  timestampAccuracy: number | null;
}
```

### Error Handling Strategy

```typescript
// Network errors: Return empty array, log error
catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    console.warn('Kismet UAV API request timeout');
  } else {
    console.error('Kismet UAV API error:', error);
  }
  return [];
}

// HTTP errors: Return empty array, warn
if (!response.ok) {
  console.warn(`Kismet UAV API returned ${response.status}`);
  return [];
}

// Malformed data: Skip invalid devices, log warning
.filter((device) => {
  if (!this.isValidUavDevice(device)) {
    console.debug('Skipping invalid UAV device:', device);
    return false;
  }
  return true;
})
```

### Health Check Integration

The existing `KismetClient` already checks Kismet availability via `/system/status.json`. This continues to work for UAV detection since the UAV PHY is part of Kismet core.

### Testing Strategy

#### Unit Tests

```typescript
describe('KismetRidClient', () => {
  it('should fetch and parse UAV devices', async () => {
    // Mock fetch to return sample Kismet UAV data
    // Assert correct mapping to RemoteIdPayload
  });

  it('should handle network errors gracefully', async () => {
    // Mock fetch to throw error
    // Assert returns empty array
  });

  it('should filter invalid devices', () => {
    // Test isValidUavDevice with various inputs
  });
});
```

#### Integration Tests

```typescript
describe('HealthMonitor with KismetRidClient', () => {
  it('should include drone detections in telemetry', async () => {
    // Start health monitor
    // Mock Kismet UAV API response
    // Assert telemetry.drone.detections contains drones
  });
});
```

#### Manual Testing

1. **No Kismet Running:**
   - Expected: `telemetry.drone.ridAvailable = false`, `detections = []`
   - No crashes, graceful degradation

2. **Kismet Running, No Drones:**
   - Expected: `telemetry.drone.ridAvailable = true`, `detections = []`

3. **Kismet Detecting DJI Drone:**
   - Expected: `detections` contains drone with manufacturer="DJI", serial number, location
   - Frontend displays drone on map

4. **Kismet API Timeout:**
   - Expected: Log warning, return empty array, continue operation

## Performance Considerations

### API Call Frequency

- Health monitor polls at 1 Hz (1000ms)
- Kismet UAV API called once per poll
- Timeout: 2000ms (allows for network delays)

### Memory Usage

- UAV devices typically <100 at any time
- Each `RemoteIdPayload` ~200 bytes
- Total memory: <20 KB for drone data

### CPU Usage

- JSON parsing: <1ms
- Mapping: <1ms per device
- Negligible impact on overall performance

## Future Enhancements (Phase 2)

### Bluetooth ASTM F3411 Support

**Dependencies:**
```json
{
  "dependencies": {
    "@abandonware/noble": "^1.9.2-15",
    "node-ffi-napi": "^2.5.0" // If using opendroneid-core-c
  }
}
```

**Implementation Approach:**

1. **Option A: Manual Parsing**
   - Use noble for BLE scanning
   - Filter advertisements by service UUID 0xFFFA
   - Parse ASTM F3411 message format manually
   - Pros: Pure JavaScript, no native bindings
   - Cons: Complex parsing, must maintain protocol spec

2. **Option B: OpenDroneID-core-c Bindings**
   - Create N-API bindings for opendroneid-core-c
   - Use node-ffi-napi for FFI calls
   - Pros: Leverage battle-tested C library
   - Cons: Native compilation, platform-specific

3. **Option C: Python Subprocess**
   - Use python-odid via subprocess
   - Communicate via JSON
   - Pros: Minimal changes, proven library
   - Cons: Overhead, dependency management

**Recommendation:** Option A (manual parsing) for better integration

## Security Considerations

### Data Privacy

- Drone IDs and serial numbers are personally identifiable
- Do NOT log or export without user consent
- Follow data retention policies

### Network Security

- Kismet API: localhost only (127.0.0.1)
- No external network requests
- Validate all JSON before parsing

### Input Validation

```typescript
// Validate coordinates
if (lat && (lat < -90 || lat > 90)) {
  console.warn('Invalid latitude:', lat);
  lat = null;
}

// Sanitize strings
droneId = String(droneId).slice(0, 100); // Max length
```

## Limitations and Caveats

### Current Implementation (Phase 1)

❌ **Not Detected:**
- Drones with Bluetooth-only Remote ID
- Drones without Wi-Fi capability
- Non-DJI drones without recognizable Wi-Fi signatures
- Operator location (not available in Wi-Fi detection)

✅ **Detected:**
- DJI drones broadcasting Wi-Fi
- Drones with recognizable SSID patterns
- Approximate drone location (from Wi-Fi signal triangulation)

### ASTM F3411 Compliance

Phase 1 implementation is **NOT ASTM F3411 compliant** because:
- Uses Wi-Fi detection, not Bluetooth
- Incomplete data (missing operator location, speed, heading)
- Not standardized protocol

Phase 2 would achieve full compliance.

## Documentation Updates Required

### User-Facing Documentation

Update README and user guide:

> **Drone Detection**
>
> The scanner detects nearby drones using Kismet's UAV detection system. Currently, it identifies drones broadcasting Wi-Fi signals (primarily DJI models).
>
> **Detected Information:**
> - Drone manufacturer and model
> - Approximate location
> - Serial number / ID
>
> **Limitations:**
> - Bluetooth-only drones are not detected
> - Operator location is not available
>
> Future updates will add support for ASTM F3411 Bluetooth Remote ID.

### Developer Documentation

Add section to CONTRIBUTING.md:

> **Drone Detection Implementation**
>
> We use Kismet's UAV API (`/phy/phyuav/devices.json`) to detect drones. See `DRONE_DETECTION_ARCHITECTURE.md` for full details.
>
> To add Bluetooth Remote ID support, see Phase 2 in the architecture document.

## Success Metrics

### Phase 1 Success Criteria

- [x] Architecture documented and approved
- [ ] KismetRidClient implementation complete
- [ ] Health monitor integration complete
- [ ] Error handling robust (no crashes on API failures)
- [ ] Frontend displays detected drones
- [ ] Manual testing with DJI drone successful
- [ ] Performance impact <5% CPU

### Phase 2 Success Criteria (Future)

- [ ] Bluetooth scanning operational
- [ ] ASTM F3411 message parsing correct
- [ ] Full compliance with FAA Remote ID requirements
- [ ] Performance impact <10% CPU
- [ ] Battery drain acceptable (<5% increase)

## References

- [Kismet UAV API Documentation](https://www.kismetwireless.net/docs/api/uav_drone/)
- [Kismet Devices API](https://www.kismetwireless.net/docs/api/devices/)
- [ASTM F3411-22a Specification](https://www.astm.org/f3411-22a.html)
- [OpenDroneID Core C Library](https://github.com/opendroneid/opendroneid-core-c)
- [OpenDroneID Specifications](https://www.opendroneid.org/specifications/)

## Revision History

| Version | Date       | Author  | Changes                                    |
|---------|------------|---------|-------------------------------------------|
| 1.0     | 2025-11-10 | Claude  | Initial architecture for Phase 1 (Kismet UAV) |
