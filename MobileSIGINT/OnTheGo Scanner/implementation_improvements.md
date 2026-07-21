# RF Scanner - Critical Implementation Improvements

## 1. DUMP1090 Interface (PRIORITY: HIGH)

**Issue:** Confusion between HTTP JSON and SBS text feed
**Solution:**

```javascript
// Standardize on HTTP JSON polling
class DUMP1090Client {
  constructor(host = '127.0.0.1', httpPort = 8080) {
    this.url = `http://${host}:${httpPort}/data/aircraft.json`;
    this.pollInterval = 1000; // 1 second
  }

  async poll() {
    try {
      const response = await fetch(this.url);
      const data = await response.json();
      return data.aircraft || [];
    } catch (err) {
      console.error('DUMP1090 HTTP poll failed:', err);
      return [];
    }
  }
}
```

## 2. Remote ID Fallback Parser (PRIORITY: HIGH)

**Issue:** Kismet may not parse Remote ID
**Solution:**

```javascript
// Fallback Remote ID parser for raw BLE advertisements
function parseRemoteIDAdvertisement(bleAdv) {
  // ASTM F3411-22a Remote ID format
  const RID_SERVICE_UUID = 0xfffa;

  if (!bleAdv.service_uuids?.includes(RID_SERVICE_UUID)) {
    return null;
  }

  // Parse message types
  const MSG_TYPE_BASIC_ID = 0x00;
  const MSG_TYPE_LOCATION = 0x01;
  const MSG_TYPE_SYSTEM = 0x03;

  // Extract from manufacturer data
  const mfgData = bleAdv.manufacturer_data;
  if (!mfgData || mfgData.length < 25) return null;

  const msgType = mfgData[0];

  switch (msgType) {
    case MSG_TYPE_BASIC_ID:
      return {
        droneId: mfgData.slice(2, 22).toString('utf8').trim(),
        type: 'basic_id',
      };
    case MSG_TYPE_LOCATION:
      return {
        lat: readInt32(mfgData, 2) / 1e7,
        lon: readInt32(mfgData, 6) / 1e7,
        altitude: readUint16(mfgData, 10),
        type: 'location',
      };
    default:
      return null;
  }
}
```

## 3. GPS Manual Fallback (PRIORITY: MEDIUM)

**Issue:** No GPS indoors
**Solution:**

```javascript
class GPSClient {
  constructor() {
    this.manualPosition = null;
    this.gpsdPosition = null;
  }

  setManualPosition(lat, lon) {
    this.manualPosition = { lat, lon, mode: 2, manual: true };
  }

  getPosition() {
    return (
      this.gpsdPosition ||
      this.manualPosition || {
        lat: 37.7749,
        lon: -122.4194,
        mode: 0,
        default: true,
      }
    );
  }
}
```

## 4. Waterfall Memory Optimization (PRIORITY: HIGH)

**Issue:** Unbounded memory growth
**Solution:**

```javascript
class OptimizedWaterfall {
  constructor(maxRows = 100, fftSize = 1024) {
    // Use circular buffer with fixed allocation
    this.buffer = new Float32Array(maxRows * fftSize);
    this.writeIndex = 0;
    this.maxRows = maxRows;
    this.fftSize = fftSize;
  }

  addRow(fftData) {
    const offset = (this.writeIndex % this.maxRows) * this.fftSize;
    this.buffer.set(fftData, offset);
    this.writeIndex++;
  }

  getBuffer() {
    // Return view of circular buffer in correct order
    const start = (this.writeIndex % this.maxRows) * this.fftSize;
    return new Float32Array([...this.buffer.slice(start), ...this.buffer.slice(0, start)]);
  }
}
```

## 5. Database Batching (PRIORITY: MEDIUM)

**Issue:** Excessive write operations
**Solution:**

```javascript
class BatchedDatabase {
  constructor(db) {
    this.db = db;
    this.batches = new Map();
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  insert(table, data) {
    if (!this.batches.has(table)) {
      this.batches.set(table, []);
    }
    this.batches.get(table).push(data);

    // Auto-flush at 100 records
    if (this.batches.get(table).length >= 100) {
      this.flushTable(table);
    }
  }

  flushTable(table) {
    const batch = this.batches.get(table);
    if (!batch || batch.length === 0) return;

    const columns = Object.keys(batch[0]);
    const placeholders = columns.map(() => '?').join(',');
    const stmt = this.db.prepare(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
    );

    const insertMany = this.db.transaction((records) => {
      for (const record of records) {
        stmt.run(...columns.map((col) => record[col]));
      }
    });

    insertMany(batch);
    this.batches.set(table, []);
  }

  flush() {
    for (const table of this.batches.keys()) {
      this.flushTable(table);
    }
  }
}
```

## 6. Progressive Loading (PRIORITY: HIGH)

**Issue:** Blank screen during initialization
**Solution:**

```javascript
// In App.jsx
function App() {
  const [loadingState, setLoadingState] = useState({
    services: 'connecting',
    map: 'loading',
    data: 'waiting',
  });

  useEffect(() => {
    // Progressive initialization
    async function init() {
      // 1. Show map immediately with cached tiles
      setLoadingState((prev) => ({ ...prev, map: 'ready' }));

      // 2. Connect to services
      await connectToBackend();
      setLoadingState((prev) => ({ ...prev, services: 'connected' }));

      // 3. Start receiving data
      startWebSocket();
      setLoadingState((prev) => ({ ...prev, data: 'streaming' }));
    }
    init();
  }, []);

  return (
    <div className="app">
      {loadingState.map === 'loading' && <LoadingOverlay />}
      <MapView />
      {loadingState.services === 'connecting' && (
        <StatusMessage>Connecting to services...</StatusMessage>
      )}
      <Dashboard />
    </div>
  );
}
```

## 7. User-Friendly Error Recovery (PRIORITY: HIGH)

**Issue:** Technical error messages
**Solution:**

```javascript
const ERROR_HANDLERS = {
  DUMP1090_UNREACHABLE: {
    title: 'Aircraft Tracker Offline',
    message: 'The aircraft tracking service is not running.',
    actions: [
      {
        label: 'Start Service',
        command: 'sudo systemctl start dump1090-mutability',
        icon: '🛩️',
      },
      {
        label: 'View Instructions',
        action: () => showHelp('dump1090'),
      },
    ],
  },
  NO_SDR_DEVICE: {
    title: 'No Radio Device Found',
    message: 'Please connect your RTL-SDR or HackRF device.',
    actions: [
      {
        label: 'Retry Detection',
        action: () => detectDevices(),
        icon: '📡',
      },
      {
        label: 'Troubleshooting Guide',
        action: () => showHelp('sdr'),
      },
    ],
  },
  GPS_NO_FIX: {
    title: 'GPS Signal Lost',
    message: 'Unable to get GPS position. You can set your location manually.',
    actions: [
      {
        label: 'Enter Location',
        action: () => showManualLocationDialog(),
        icon: '📍',
      },
    ],
  },
};

function ErrorNotification({ error }) {
  const handler = ERROR_HANDLERS[error.code];
  if (!handler) return null;

  return (
    <div className="error-notification">
      <h3>{handler.title}</h3>
      <p>{handler.message}</p>
      <div className="error-actions">
        {handler.actions.map((action) => (
          <button onClick={action.action || (() => runCommand(action.command))}>
            {action.icon} {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

## 8. Input Validation (PRIORITY: HIGH)

**Issue:** Malformed data can crash app
**Solution:**

```javascript
const validators = {
  aircraft: (ac) => {
    if (!ac.hex || !/^[a-f0-9]{6}$/i.test(ac.hex)) return null;

    return {
      icao: ac.hex,
      callsign: ac.flight?.trim().substring(0, 8),
      lat: validateLat(ac.lat),
      lon: validateLon(ac.lon),
      altitude: clamp(ac.altitude, -2000, 60000),
      speed: clamp(ac.speed, 0, 800),
      heading: clamp(ac.track, 0, 359),
    };
  },

  drone: (drone) => {
    if (!drone.drone_id || drone.drone_id.length > 20) return null;

    return {
      droneId: drone.drone_id.substring(0, 20),
      lat: validateLat(drone.lat),
      lon: validateLon(drone.lon),
      altitude: clamp(drone.altitude, 0, 400), // 400m max for drones
      operatorLat: validateLat(drone.operator_lat),
      operatorLon: validateLon(drone.operator_lon),
    };
  },
};

function validateLat(lat) {
  if (typeof lat !== 'number') return null;
  return clamp(lat, -90, 90);
}

function validateLon(lon) {
  if (typeof lon !== 'number') return null;
  return clamp(lon, -180, 180);
}

function clamp(val, min, max) {
  if (typeof val !== 'number') return null;
  return Math.min(Math.max(val, min), max);
}
```

## 9. Resource Limits (PRIORITY: MEDIUM)

**Issue:** Memory exhaustion from too many objects
**Solution:**

```javascript
class ResourceLimiter {
  constructor() {
    this.limits = {
      aircraft: 500,
      drones: 100,
      signals: 1000,
      waterfallRows: 100,
    };

    this.collections = {
      aircraft: new Map(),
      drones: new Map(),
      signals: [],
    };
  }

  add(type, id, data) {
    const collection = this.collections[type];
    const limit = this.limits[type];

    if (collection instanceof Map) {
      // For aircraft/drones, remove oldest if at limit
      if (collection.size >= limit && !collection.has(id)) {
        const firstKey = collection.keys().next().value;
        collection.delete(firstKey);
      }
      collection.set(id, { ...data, timestamp: Date.now() });
    } else {
      // For signals array
      if (collection.length >= limit) {
        collection.shift();
      }
      collection.push(data);
    }
  }

  get(type) {
    const collection = this.collections[type];
    return collection instanceof Map ? Array.from(collection.values()) : collection;
  }
}
```

## 10. Mock Data Generator (PRIORITY: LOW)

**Issue:** Can't develop without hardware
**Solution:**

```javascript
class MockDataGenerator {
  constructor(centerLat = 37.7749, centerLon = -122.4194) {
    this.center = { lat: centerLat, lon: centerLon };
    this.aircraft = new Map();
    this.drones = new Map();
  }

  startMockStreams(wsServer) {
    // Generate initial objects
    for (let i = 0; i < 10; i++) {
      this.aircraft.set(`MOCK${i}`, this.generateAircraft(i));
    }
    for (let i = 0; i < 3; i++) {
      this.drones.set(`DRONE${i}`, this.generateDrone(i));
    }

    // Update positions
    setInterval(() => {
      this.updatePositions();

      const data = {
        aircraft: Array.from(this.aircraft.values()),
        drones: Array.from(this.drones.values()),
        signals: this.generateSignals(),
        gps: {
          lat: this.center.lat,
          lon: this.center.lon,
          mode: 3,
        },
      };

      wsServer.broadcast(JSON.stringify(data));
    }, 1000);
  }

  generateAircraft(index) {
    return {
      icao: `MOCK${index.toString().padStart(3, '0')}`,
      callsign: `TEST${index}`,
      lat: this.center.lat + (Math.random() - 0.5) * 0.5,
      lon: this.center.lon + (Math.random() - 0.5) * 0.5,
      altitude: 5000 + Math.random() * 30000,
      speed: 200 + Math.random() * 300,
      heading: Math.random() * 360,
    };
  }

  generateDrone(index) {
    const droneLat = this.center.lat + (Math.random() - 0.5) * 0.02;
    const droneLon = this.center.lon + (Math.random() - 0.5) * 0.02;

    return {
      droneId: `MOCKDRONE${index}`,
      manufacturer: ['DJI', 'Autel', 'Parrot'][index % 3],
      droneLat,
      droneLon,
      droneAltitude: 50 + Math.random() * 100,
      operatorLat: droneLat + (Math.random() - 0.5) * 0.001,
      operatorLon: droneLon + (Math.random() - 0.5) * 0.001,
      speed: Math.random() * 20,
      heading: Math.random() * 360,
    };
  }

  generateSignals() {
    return Array.from({ length: 20 }, () => ({
      frequency: 108 + Math.random() * 29, // Airband range
      signalStrength: -80 + Math.random() * 50,
      bandwidth: 8000 + Math.random() * 17000,
      bandName: 'Airband',
    }));
  }

  updatePositions() {
    // Move aircraft
    for (const ac of this.aircraft.values()) {
      const rad = (ac.heading * Math.PI) / 180;
      const speed = ac.speed * 0.514444; // knots to m/s
      const distance = speed / 111111; // meters to degrees (rough)

      ac.lat += Math.cos(rad) * distance;
      ac.lon += Math.sin(rad) * distance;

      // Random heading change
      ac.heading = (ac.heading + (Math.random() - 0.5) * 5 + 360) % 360;
    }

    // Move drones
    for (const drone of this.drones.values()) {
      drone.droneLat += (Math.random() - 0.5) * 0.0001;
      drone.droneLon += (Math.random() - 0.5) * 0.0001;
    }
  }
}

// Usage in development:
if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DATA) {
  const mockGen = new MockDataGenerator();
  mockGen.startMockStreams(wss);
}
```

## 11. Setup Script Improvements (PRIORITY: MEDIUM)

```bash
# Add to setup.sh

# Dry run mode
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
    echo "DRY RUN MODE - No changes will be made"
fi

# Backup existing configs
backup_configs() {
    if [ -f /etc/kismet/kismet.conf ]; then
        cp /etc/kismet/kismet.conf /etc/kismet/kismet.conf.backup.$(date +%Y%m%d)
    fi
}

# Verification tests
verify_installation() {
    echo "Running verification tests..."

    # Test RTL-SDR
    if rtl_test -t 2>&1 | grep -q "Found"; then
        echo "✅ RTL-SDR detected"
    else
        echo "⚠️  RTL-SDR not detected (may need to plug in device)"
    fi

    # Test dump1090
    if systemctl is-active --quiet dump1090-mutability; then
        echo "✅ DUMP1090 running"
    else
        echo "⚠️  DUMP1090 not running"
    fi

    # Test Kismet
    if pgrep kismet > /dev/null; then
        echo "✅ Kismet running"
    else
        echo "⚠️  Kismet not running"
    fi

    # Test GPS
    if timeout 2 gpspipe -w -n 1 > /dev/null 2>&1; then
        echo "✅ GPS responding"
    else
        echo "⚠️  GPS not responding (may need to be outdoors)"
    fi
}
```

## 12. Quick Test Commands (PRIORITY: LOW)

Add to package.json:

```json
{
  "scripts": {
    "test:services": "node scripts/test-services.js",
    "test:mock": "USE_MOCK_DATA=true npm start",
    "test:perf": "node scripts/performance-test.js",
    "doctor": "node scripts/doctor.js"
  }
}
```

## Implementation Priority Order

### Phase 1 (Critical):

1. DUMP1090 HTTP JSON interface
2. Input validation
3. Resource limits
4. Waterfall memory optimization

### Phase 2 (Important):

5. GPS manual fallback
6. User-friendly error recovery
7. Progressive loading
8. Database batching

### Phase 3 (Nice to have):

9. Remote ID fallback parser
10. Mock data generator
11. Setup script improvements
12. Quick test commands

## Testing Checklist

- [ ] Test with no hardware connected
- [ ] Test with only RTL-SDR
- [ ] Test with RTL-SDR + GPS
- [ ] Test indoors (no GPS fix)
- [ ] Test with 100+ aircraft
- [ ] Test for 1+ hour (memory leaks)
- [ ] Test with malformed DUMP1090 data
- [ ] Test service recovery after crash
- [ ] Test export with large dataset
- [ ] Test on minimum spec hardware

## Performance Targets

- Cold start to map: < 3 seconds
- Service connection: < 5 seconds
- First aircraft display: < 10 seconds
- Memory after 1 hour: < 800 MB
- CPU during scanning: < 40%
- Waterfall frame rate: >= 10 Hz
