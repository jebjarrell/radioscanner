# Phase 2: Bluetooth ASTM F3411 Remote ID Implementation Plan

## Overview

Implement full ASTM F3411 Bluetooth Remote ID support to detect all compliant drones, not just Wi-Fi broadcasting ones.

## Implementation Strategy

### Chosen Approach: Manual ASTM F3411 Parsing

**Why Manual Parsing:**
- ✅ Pure JavaScript/TypeScript - no native compilation
- ✅ Full control over parsing logic
- ✅ Better debugging and error handling
- ✅ No platform-specific build issues
- ✅ Smaller dependency footprint
- ✅ ASTM F3411 spec is well-documented and straightforward

**Alternative (Rejected): OpenDroneID-Core-C Bindings**
- ❌ Requires N-API or node-ffi-napi
- ❌ Platform-specific compilation
- ❌ Build complexity
- ❌ Overkill for this use case

## Dependencies

### Required npm Packages

```bash
npm install @abandonware/noble
npm install --save-dev @types/node
```

**@abandonware/noble:**
- Most maintained fork of noble (original is abandoned)
- Supports Linux (BlueZ), macOS (Core Bluetooth), Windows (via noble-winrt)
- Passive BLE scanning
- Service UUID filtering

## ASTM F3411 Message Format

### Service UUID
- **0xFFFA** (65530 decimal) - ASTM Remote ID service

### Message Types

```typescript
enum MessageType {
  BASIC_ID = 0x0,           // UAS identifier
  LOCATION_VECTOR = 0x1,    // Position, altitude, speed, heading
  AUTHENTICATION = 0x2,     // Authentication data (optional)
  SELF_ID = 0x3,            // Operator text description
  SYSTEM = 0x4,             // Operator location, timestamp
  OPERATOR_ID = 0x5,        // Operator registration number
}
```

### Message Structure

Each message is **25 bytes**:
- Byte 0: Message Type (0x0-0x5)
- Bytes 1-24: Message-specific payload

### Basic ID Message (Type 0x0)

```
Byte 0: Message Type (0x0)
Byte 1: ID Type (0=None, 1=Serial, 2=CAA, 3=UTM, 4=Specific)
Bytes 2-21: UAS ID (20 bytes ASCII)
Byte 22-24: Reserved
```

### Location/Vector Message (Type 0x1)

```
Byte 0: Message Type (0x1)
Byte 1: Status flags
Byte 2: Direction (heading in degrees / 2)
Byte 3: Speed horizontal (0.25 m/s units)
Byte 4: Speed vertical (0.5 m/s units)
Bytes 5-8: Latitude (1e-7 degrees, int32)
Bytes 9-12: Longitude (1e-7 degrees, int32)
Bytes 13-14: Altitude (0.5m units above WGS84, uint16)
Bytes 15-16: Height (0.5m units above takeoff, uint16)
Byte 17: Horizontal accuracy
Byte 18: Vertical accuracy
Byte 19: Barometer accuracy
Byte 20: Speed accuracy
Byte 21-22: Timestamp (0.1s since hour, uint16)
Byte 23-24: Reserved
```

### System Message (Type 0x4)

```
Byte 0: Message Type (0x4)
Byte 1: Operator location type
Bytes 2-3: Classification
Bytes 4-7: Operator latitude (1e-7 degrees, int32)
Bytes 8-11: Operator longitude (1e-7 degrees, int32)
Bytes 12-13: Area count, area radius, area ceiling, area floor
Byte 14: Category
Byte 15: Class
Bytes 16-19: Operator altitude (1m units, int32)
Bytes 20-21: Timestamp (seconds since hour)
Byte 22-24: Reserved
```

## Implementation Files

### 1. `src/backend/clients/astmParser.ts`

ASTM F3411 message parser:

```typescript
export interface AstmBasicId {
  messageType: 0x0;
  idType: number;
  uasId: string;
}

export interface AstmLocation {
  messageType: 0x1;
  status: number;
  direction: number;  // degrees
  speedHorizontal: number;  // m/s
  speedVertical: number;  // m/s
  latitude: number;  // degrees
  longitude: number;  // degrees
  altitudeWgs84: number;  // meters
  heightAboveTakeoff: number;  // meters
  horizontalAccuracy: number;
  verticalAccuracy: number;
  timestamp: number;
}

export interface AstmSystem {
  messageType: 0x4;
  operatorLatitude: number;
  operatorLongitude: number;
  operatorAltitude: number;
  timestamp: number;
}

export type AstmMessage = AstmBasicId | AstmLocation | AstmSystem;

export class AstmF3411Parser {
  static parse(buffer: Buffer): AstmMessage | null;
  static parseBasicId(buffer: Buffer): AstmBasicId | null;
  static parseLocation(buffer: Buffer): AstmLocation | null;
  static parseSystem(buffer: Buffer): AstmSystem | null;
}
```

### 2. `src/backend/clients/bluetoothRidClient.ts`

Bluetooth scanner client:

```typescript
export class BluetoothRidClient {
  private scanning: boolean = false;
  private drones: Map<string, RemoteIdPayload>;

  async start(): Promise<void>;
  stop(): void;
  getDetections(): RemoteIdPayload[];
  private handleAdvertisement(address: string, data: Buffer): void;
}
```

### 3. Update `src/backend/health.ts`

Integrate Bluetooth client alongside Kismet client:

```typescript
private readonly bluetoothRidClient: BluetoothRidClient;

// Merge detections from both sources
const kismetDrones = await this.kismetRidClient.fetchRemoteId();
const bluetoothDrones = this.bluetoothRidClient.getDetections();
const allDrones = this.mergeDroneDetections([...kismetDrones, ...bluetoothDrones]);
```

## Deduplication Strategy

Since we'll have two sources (Kismet Wi-Fi + Bluetooth), we need deduplication:

```typescript
function mergeDroneDetections(drones: RemoteIdPayload[]): RemoteIdPayload[] {
  const map = new Map<string, RemoteIdPayload>();

  for (const drone of drones) {
    const existing = map.get(drone.droneId);

    if (!existing) {
      map.set(drone.droneId, drone);
    } else {
      // Prefer Bluetooth (more complete data) over Wi-Fi
      if (drone.operatorLat !== null && existing.operatorLat === null) {
        map.set(drone.droneId, { ...existing, ...drone });
      }
    }
  }

  return Array.from(map.values());
}
```

## Error Handling

```typescript
// Bluetooth scanner
try {
  await noble.startScanningAsync([REMOTE_ID_SERVICE_UUID], false);
} catch (error) {
  console.error('Failed to start Bluetooth scanning:', error);
  // Continue without Bluetooth - graceful degradation
}

// Message parsing
try {
  const message = AstmF3411Parser.parse(buffer);
  if (message) {
    this.processMessage(address, message);
  }
} catch (error) {
  console.warn('Failed to parse ASTM message:', error);
  // Skip invalid message, continue scanning
}
```

## Platform Considerations

### Linux (Primary Target)
- Requires **BlueZ** (usually pre-installed)
- User must be in `bluetooth` group: `sudo usermod -aG bluetooth $USER`
- May require elevated permissions for BLE scanning

### macOS
- Uses Core Bluetooth (built-in)
- No additional setup required

### Windows
- Requires noble-winrt
- May require additional configuration

## Security & Privacy

### Permissions
- Bluetooth access requires user permission
- Add capability request in Electron main process
- Inform user in UI when Bluetooth scanning is active

### Data Handling
- Drone IDs are potentially personally identifiable
- Do NOT log drone IDs to console in production
- Follow data retention policies
- Provide clear privacy notice to users

## Testing Strategy

### Unit Tests

```typescript
describe('AstmF3411Parser', () => {
  it('should parse Basic ID message', () => {
    const buffer = Buffer.from([
      0x00, // Message type
      0x01, // ID type: Serial
      ...Buffer.from('DJI-ABC123\0\0\0\0\0\0\0\0\0\0', 'ascii'),
      0x00, 0x00, 0x00 // Reserved
    ]);

    const message = AstmF3411Parser.parseBasicId(buffer);
    expect(message?.uasId).toBe('DJI-ABC123');
  });

  it('should parse Location message', () => {
    // Test location parsing with known coordinates
  });
});
```

### Integration Tests

```typescript
describe('BluetoothRidClient', () => {
  it('should detect drone from BLE advertisement', async () => {
    const client = new BluetoothRidClient();
    await client.start();

    // Simulate BLE advertisement
    // Check detections

    client.stop();
  });
});
```

### Manual Testing

1. **Simulator**: Use OpenDroneID transmitter app on phone
2. **Real Drone**: Test with actual DJI drone broadcasting Remote ID
3. **Multiple Drones**: Test deduplication with multiple sources

## Performance Considerations

### CPU Usage
- BLE scanning: ~5% CPU (passive listening)
- Message parsing: <1ms per message
- Expected: <10% additional CPU usage

### Memory Usage
- Noble library: ~10 MB
- Drone cache: ~1 KB per drone × 100 drones = ~100 KB
- Expected: <20 MB additional memory

### Battery Impact (if on laptop)
- BLE scanning uses radio continuously
- Expected 5-10% additional battery drain
- Provide user option to disable Bluetooth scanning

## Rollout Plan

### Phase 2.1: Parser Implementation ✅
1. Install @abandonware/noble
2. Implement AstmF3411Parser
3. Unit tests for parser

### Phase 2.2: Bluetooth Client ✅
1. Implement BluetoothRidClient
2. Start/stop scanning
3. Handle advertisements
4. Map to RemoteIdPayload

### Phase 2.3: Integration ✅
1. Update HealthMonitor
2. Merge Kismet + Bluetooth detections
3. Deduplication logic

### Phase 2.4: Testing & Polish ✅
1. Integration tests
2. Manual testing with simulator
3. Performance profiling
4. Documentation updates

### Phase 2.5: Deployment ✅
1. Update README with Bluetooth requirements
2. Add user permissions guide
3. Privacy notice
4. Release notes

## Success Criteria

- [ ] Detects ASTM F3411 compliant drones via Bluetooth
- [ ] Parses all 6 message types correctly
- [ ] Merges Wi-Fi and Bluetooth detections without duplicates
- [ ] Operator location displayed when available
- [ ] Graceful degradation if Bluetooth unavailable
- [ ] <10% CPU overhead
- [ ] <20 MB memory overhead
- [ ] Full ASTM F3411-22a compliance

## Timeline Estimate

- **Parser Implementation**: 2-3 hours
- **Bluetooth Client**: 3-4 hours
- **Integration**: 2 hours
- **Testing**: 2-3 hours
- **Documentation**: 1 hour
- **Total**: 10-13 hours

## References

- [ASTM F3411-22a Specification](https://www.astm.org/f3411-22a.html)
- [OpenDroneID Core C Library](https://github.com/opendroneid/opendroneid-core-c)
- [@abandonware/noble Documentation](https://github.com/abandonware/noble)
- [Remote ID Message Structure](https://www.opendroneid.org/specifications/)
