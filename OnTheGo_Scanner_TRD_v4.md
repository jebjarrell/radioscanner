# TECHNICAL REQUIREMENTS DOCUMENT (TRD)
## On-the-Go RF Awareness Scanner
### Version 1.0 MVP - Linux Implementation

**Document Version:** 2.0  
**Last Updated:** October 16, 2025  
**Status:** Final for Development  
**Related Documents:** PRD v2.0

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Component Specifications](#component-specifications)
4. [External Dependencies](#external-dependencies)
5. [API Contracts](#api-contracts)
6. [Database Schema](#database-schema)
7. [File Structure](#file-structure)
8. [Build & Deployment](#build--deployment)
9. [Development Environment](#development-environment)
10. [Testing Strategy](#testing-strategy)
11. [Performance Optimization](#performance-optimization)
12. [Security Considerations](#security-considerations)
13. [Appendices](#appendices)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON MAIN PROCESS                      │
│  - Window management                                             │
│  - IPC bridge to renderer                                        │
│  - Lifecycle management                                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
┌────────▼────────┐    ┌────────▼────────────────────────────────┐
│  ELECTRON       │    │       NODE.JS BACKEND SERVER            │
│  RENDERER       │    │     (Express/Fastify on port 3000)      │
│  (React UI)     │    │                                          │
│                 │    │  ┌──────────────────────────────────┐   │
│  Components:    │    │  │  Data Aggregation Layer          │   │
│  - MapView      │◄───┼──┤  - Merges all data sources       │   │
│  - Dashboard    │ WS │  │  - Broadcasts via WebSocket      │   │
│  - Waterfall    │    │  └──────────────────────────────────┘   │
│  - DetailPanels │    │                                          │
│                 │    │  ┌─────────────┬────────────┬─────────┐ │
└─────────────────┘    │  │ DUMP1090    │  Kismet    │  SDR    │ │
                       │  │ Client      │  Client    │ Client  │ │
                       │  │ (Aircraft)  │  (Drones)  │ (Scan)  │ │
                       │  └─────┬───────┴─────┬──────┴────┬────┘ │
                       └────────┼─────────────┼───────────┼──────┘
                                │             │           │
                    ┌───────────▼─┐    ┌─────▼──────┐   │
                    │ DUMP1090    │    │  Kismet    │   │
                    │ (External)  │    │ (External) │   │
                    │ JSON:30003 (SBS text feed)  │    │ REST:2501  │   │
                    └─────────────┘    └────────────┘   │
                                                         │
                         ┌───────────────────────────────▼─────┐
                         │     SoapySDR (Deferred to vNext) Server (External)      │
                         │          TCP Socket :55132          │
                         └──────────┬────────────┬─────────────┘
                                    │            │
                             ┌──────▼──────┐ ┌──▼──────────┐
                             │  RTL-SDR    │ │  HackRF     │
                             │  Hardware   │ │  Hardware   │
                             └─────────────┘ └─────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     SUPPORTING SERVICES                          │
│                                                                   │
│  ┌──────────┐   ┌──────────────┐   ┌─────────────────────┐    │
│  │  gpsd    │   │   SQLite     │   │  MapLibre Tiles     │    │
│  │ :2947    │   │  Database    │   │  (localhost/CDN)    │    │
│  └──────────┘   └──────────────┘   └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
┌──────────────┐
│ DUMP1090     │ HTTP JSON (/data/aircraft.json via dump1090 web, default :8080) ──┐
└──────────────┘                 │
                                 │
┌──────────────┐                 │    ┌─────────────────┐
│ Kismet       │ REST (2501) ────┼───►│  Node.js        │
└──────────────┘                 │    │  Backend        │
                                 │    │  Aggregator     │
┌──────────────┐                 │    └────────┬────────┘
│ SoapySDR (Deferred to vNext)     │ TCP (55132) ────┤             │
└──────────────┘                 │             │ WebSocket
                                 │             │ (JSON)
┌──────────────┐                 │             │
│ gpsd         │ JSON (2947) ────┘             │
└──────────────┘                               │
                                               │
                                        ┌──────▼──────┐
                                        │  Electron   │
                                        │  Renderer   │
                                        │  (React)    │
                                        └─────────────┘
                                               │
                                        ┌──────▼──────┐
                                        │  MapLibre   │
                                        │  Waterfall  │
                                        │  Dashboard  │
                                        └─────────────┘
```

### Process Architecture

```
User Space:
  electron (main) PID 1234
    ├─ electron (renderer) PID 1235
    └─ node backend.js PID 1236
       ├─ dump1090-client.js (thread)
       ├─ kismet-client.js (thread)
       ├─ sdr-client.js (thread)
       └─ gps-client.js (thread)

System Services (managed by systemd):
  dump1090 PID 500
  kismet PID 501
  gpsd PID 502
  SoapySDRServer PID 503 (optional, or spawned by backend)
```

---

## Technology Stack

### Core Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Desktop Framework** | Electron | 28.0+ | Cross-platform desktop app |
| **Backend Runtime** | Node.js | 18 LTS | JavaScript runtime |
| **Frontend Framework** | React | 18.2+ | UI component library |
| **Backend Server** | Fastify | 4.24+ | High-performance HTTP server |
| **Database** | SQLite3 | 3.40+ | Embedded database |
| **Database Driver** | better-sqlite3 | 9.0+ | Synchronous SQLite bindings |
| **Mapping** | MapLibre GL JS | 3.6+ | Interactive maps |
| **Real-time Communication** | ws (WebSocket) | 8.14+ | Bi-directional communication |
| **Build Tool** | Webpack | 5.89+ | Module bundling |
| **Package Manager** | npm | 9.0+ | Dependency management |

### Key Libraries

#### Backend (Node.js)
```json
{
  "fastify": "^4.24.0",
  "ws": "^8.14.0",
  "better-sqlite3": "^9.0.0",
  "node-fetch": "^3.3.0",
  "serialport": "^12.0.0",
  "fft.js": "^4.0.4",
  "winston": "^3.11.0"
}
```

#### Frontend (React)
```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "maplibre-gl": "^3.6.0",
  "d3-scale": "^4.0.2",
  "recharts": "^2.10.0"
}
```

#### Electron
```json
{
  "electron": "^28.0.0",
  "electron-builder": "^24.6.0"
}
```

### External Dependencies (System Level)

| Service | Package | Version | Install Method |
|---------|---------|---------|----------------|
| DUMP1090 | dump1090-mutability | 1.15+ | apt-get |
| Kismet | kismet | 2022+  | apt-get |
| SoapySDR (Deferred to vNext) | soapysdr-server | 0.8+ | apt-get |
| SoapySDR (Deferred to vNext) RTL Module | soapysdr-module-rtlsdr | 0.3+ | apt-get |
| SoapySDR (Deferred to vNext) HackRF Module | soapysdr-module-hackrf | 0.3+ | apt-get |
| GPS Daemon | gpsd | 3.20+ | apt-get |
| GPS Clients | gpsd-clients | 3.20+ | apt-get |

---

## Component Specifications

### 1. Electron Main Process

**File:** `electron/main.js`

**Responsibilities:**
- Create and manage application window
- Handle IPC communication between main and renderer
- Spawn Node.js backend server as child process
- Manage application lifecycle (quit, close, minimize)
- Handle system tray icon (future)

**Key APIs:**
```javascript
const { app, BrowserWindow, ipcMain } = require('electron');

// Window configuration
const mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  minWidth: 1280,
  minHeight: 720,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js')
  }
});

// Spawn backend server
const backend = spawn('node', ['backend/server.js'], {
  env: { ...process.env, PORT: 3000 }
});
```

**Performance Targets:**
- Window launch time: <2 seconds
- Memory footprint: <150 MB (main process only)

---

### 2. Node.js Backend Server

**File:** `backend/server.js`

**Responsibilities:**
- HTTP server for serving frontend assets (development mode)
- WebSocket server for real-time data streaming
- Coordinate data collection from external services
- Aggregate and normalize data from multiple sources
- Database operations (SQLite reads/writes)
- Serve REST API for frontend queries

**Architecture:**
```javascript
const fastify = require('fastify')({ logger: true });
const WebSocket = require('ws');

// Initialize data clients
const dump1090Client = require('./clients/dump1090-client');
const kismetClient = require('./clients/kismet-client');
const sdrClient = require('./clients/sdr-client');
const gpsClient = require('./clients/gps-client');

// WebSocket server
const wss = new WebSocket.Server({ port: 3001 });

// Main event loop
setInterval(() => {
  const aggregatedData = {
    aircraft: dump1090Client.getAircraft(),
    drones: kismetClient.getDrones(),
    signals: sdrClient.getSignals(),
    gps: gpsClient.getPosition()
  };
  
  // Broadcast to all connected clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(aggregatedData));
    }
  });
}, 1000); // 1 Hz update rate

fastify.listen({ port: 3000, host: '127.0.0.1' });
```

**REST Endpoints:**
- `GET /health` - Health check, returns status of all services
- `GET /api/aircraft` - Get all aircraft (snapshot)
- `GET /api/drones` - Get all drones (snapshot)
- `GET /api/signals` - Get RF signals (snapshot)
- `GET /api/bands` - Get available frequency bands
- `POST /api/export` - Trigger data export
- `GET /api/devices` - Get detected SDR devices
- `POST /api/scan/start` - Start spectrum scanning
- `POST /api/scan/stop` - Stop spectrum scanning

**Performance Targets:**
- API response time: <50ms (local host)
- WebSocket message rate: 1 Hz (configurable up to 10 Hz)
- Concurrent WebSocket connections: 10 (future: remote monitoring)

---

### 3. DUMP1090 Client

**File:** `backend/clients/dump1090-client.js`

**Purpose:** Consume JSON data from DUMP1090 and parse aircraft information

**DUMP1090 JSON Format:**
DUMP1090 outputs JSON on TCP port 30003 (SBS text feed) (default). Messages are line-delimited JSON objects.

**Example Message:**
```json
{
  "now": 1697452800.12,
  "messages": 12345,
  "aircraft": [
    {
      "hex": "a12345",
      "squawk": "1200",
      "flight": "UAL123  ",
      "lat": 37.7749,
      "lon": -122.4194,
      "altitude": 35000,
      "vert_rate": 0,
      "track": 270,
      "speed": 450,
      "messages": 100,
      "seen": 0.5,
      "rssi": -10.2
    }
  ]
}
```

**Implementation:**
```javascript
const net = require('net');

class DUMP1090Client {
  constructor(host = '127.0.0.1', port = 30003 (SBS text feed)) {
    this.host = host;
    this.port = port;
    this.aircraft = new Map(); // key: ICAO hex, value: aircraft object
    this.connect();
  }

  connect() {
    this.socket = net.createConnection({ host: this.host, port: this.port });
    
    this.socket.on('data', (data) => {
      try {
        const json = JSON.parse(data.toString());
        if (json.aircraft) {
          json.aircraft.forEach(ac => {
            this.aircraft.set(ac.hex, {
              icao: ac.hex,
              callsign: ac.flight ? ac.flight.trim() : null,
              altitude: ac.altitude,
              speed: ac.speed,
              heading: ac.track,
              lat: ac.lat,
              lon: ac.lon,
              verticalRate: ac.vert_rate,
              squawk: ac.squawk,
              lastSeen: Date.now()
            });
          });
        }
      } catch (err) {
        console.error('DUMP1090 parse error:', err);
      }
    });

    this.socket.on('error', (err) => {
      console.error('DUMP1090 connection error:', err);
      setTimeout(() => this.connect(), 5000); // Retry after 5s
    });
  }

  getAircraft() {
    // Remove stale aircraft (not seen in 60 seconds)
    const now = Date.now();
    for (let [key, ac] of this.aircraft.entries()) {
      if (now - ac.lastSeen > 60000) {
        this.aircraft.delete(key);
      }
    }
    return Array.from(this.aircraft.values());
  }

  isConnected() {
    return this.socket && !this.socket.destroyed;
  }
}

module.exports = new DUMP1090Client();
```

**Error Handling:**
- Connection failures: Auto-reconnect with exponential backoff
- Malformed JSON: Log error, skip message, continue
- Stale aircraft: Remove after 60 seconds without update

---

### 4. Kismet Client

**File:** `backend/clients/kismet-client.js`

**Purpose:** Query Kismet REST API for drone Remote ID detections

**Kismet REST API Endpoints:**
- `http://localhost:2501/devices/all_devices.json` - All detected devices
- `http://localhost:2501/phy/phy80211/ssids.json` - WiFi SSIDs (future)
- `http://localhost:2501/phy/BLUETOOTH/devices.json` - Bluetooth devices

**Remote ID Detection:**
Kismet detects Remote ID broadcasts as Bluetooth devices with specific service UUIDs:
- Service UUID: `0xFFFA` (ASTM Remote ID)
- Device type: `BLUETOOTH_LE`
- Advertisement contains Remote ID payload

**Implementation:**
```javascript
const fetch = require('node-fetch');

class KismetClient {
  constructor(baseUrl = 'http://127.0.0.1:2501') {
    this.baseUrl = baseUrl;
    this.drones = new Map();
    this.pollInterval = setInterval(() => this.poll(), 2000); // Poll every 2s
  }

  async poll() {
    try {
      const response = await fetch(`${this.baseUrl}/phy/BLUETOOTH/devices.json`);
      const devices = await response.json();
      
      devices.forEach(device => {
        // Filter for Remote ID devices
        if (this.isRemoteID(device)) {
          const remoteIdData = this.parseRemoteID(device);
          if (remoteIdData) {
            this.drones.set(remoteIdData.droneId, {
              ...remoteIdData,
              lastSeen: Date.now()
            });
          }
        }
      });
    } catch (err) {
      console.error('Kismet poll error:', err);
    }
  }

  isRemoteID(device) {
    // Check for Remote ID service UUID in advertisement
    if (!device.kismet_device_base_services) return false;
    const services = device.kismet_device_base_services;
    return services.includes('0xFFFA') || services.includes('FFFA');
  }

  parseRemoteID(device) {
    // Parse Remote ID payload from Kismet device object
    // Remote ID data is in device.kismet_device_base_manuf
    const manuf = device.kismet_device_base_manuf || '';
    const adv = device.kismet_bluetooth_device_le_adv_data || {};

    // Extract Basic ID (UAS ID)
    const droneId = this.extractBasicId(adv);
    if (!droneId) return null;

    // Extract Location/Vector Message
    const location = this.extractLocation(adv);
    const operator = this.extractOperatorLocation(adv);

    return {
      droneId: droneId,
      manufacturer: this.identifyManufacturer(manuf, droneId),
      model: null, // Not always available in Remote ID
      droneLat: location?.lat,
      droneLon: location?.lon,
      droneAltitude: location?.altitude,
      operatorLat: operator?.lat,
      operatorLon: operator?.lon,
      operatorAltitude: operator?.altitude,
      speed: location?.speed,
      heading: location?.heading,
      heightAgl: location?.heightAgl,
      timestampAccuracy: location?.timestampAccuracy
    };
  }

  extractBasicId(advData) {
    // Parse ASTM F3411 Basic ID Message (Message Type 0x0)
    // Payload format: [MessageType(1)][IDType(1)][UAS_ID(20)]
    // This is a simplified example - actual parsing depends on Kismet's format
    if (advData.basic_id) {
      return advData.basic_id.uas_id || null;
    }
    return null;
  }

  extractLocation(advData) {
    // Parse ASTM F3411 Location/Vector Message (Message Type 0x1)
    if (advData.location) {
      return {
        lat: advData.location.latitude,
        lon: advData.location.longitude,
        altitude: advData.location.altitude,
        speed: advData.location.speed,
        heading: advData.location.heading,
        heightAgl: advData.location.height,
        timestampAccuracy: advData.location.timestamp_accuracy
      };
    }
    return null;
  }

  extractOperatorLocation(advData) {
    // Parse ASTM F3411 System Message (Message Type 0x3) for operator location
    if (advData.system && advData.system.operator_location) {
      return {
        lat: advData.system.operator_location.latitude,
        lon: advData.system.operator_location.longitude,
        altitude: advData.system.operator_location.altitude
      };
    }
    return null;
  }

  identifyManufacturer(manuf, droneId) {
    // Heuristic identification based on manufacturer field or drone ID pattern
    if (manuf.includes('DJI') || droneId.startsWith('DJI')) return 'DJI';
    if (manuf.includes('Autel')) return 'Autel';
    if (manuf.includes('Parrot')) return 'Parrot';
    return 'Unknown';
  }

  getDrones() {
    // Remove stale drones (not seen in 30 seconds)
    const now = Date.now();
    for (let [key, drone] of this.drones.entries()) {
      if (now - drone.lastSeen > 30000) {
        this.drones.delete(key);
      }
    }
    return Array.from(this.drones.values());
  }

  isConnected() {
    // Check if Kismet is reachable
    return fetch(`${this.baseUrl}/system/status.json`, { timeout: 1000 })
      .then(() => true)
      .catch(() => false);
  }
}

module.exports = new KismetClient();
```

**Configuration:**
Kismet must be configured to monitor Bluetooth:
```bash
# /etc/kismet/kismet.conf (or ~/.kismet/kismet.conf)
source=hci0:name=BluetoothAdapter
```

**Note:** Kismet's Remote ID parsing may vary by version. This implementation assumes Kismet exposes Remote ID data in its device JSON. If not, raw Bluetooth advertisement parsing will be required.

---

### 5. SDR Client (SoapySDR (Deferred to vNext))

**File:** `backend/clients/sdr-client.js`

**Purpose:** Interface with SoapySDR (Deferred to vNext) Server for spectrum scanning and FFT generation

**SoapySDR (Deferred to vNext) Server:**
SoapySDR (Deferred to vNext) Server provides a network interface to SDR hardware. It can be run as:
```bash
SoapySDRServer --bind="127.0.0.1:55132"
```

Or spawned programmatically by the Node.js backend.

**SDR Client Implementation:**
```javascript
const net = require('net');
const FFT = require('fft.js');

class SDRClient {
  constructor(host = '127.0.0.1', port = 55132) {
    this.host = host;
    this.port = port;
    this.isScanning = false;
    this.currentBand = null;
    this.fftSize = 2048;
    this.fft = new FFT(this.fftSize);
    this.signals = [];
    this.waterfallBuffer = [];
  }

  async connect() {
    // SoapySDR (Deferred to vNext) uses a custom protocol over TCP
    // For MVP, we'll use rtl_tcp as a simpler alternative
    // rtl_tcp is part of rtl-sdr package and provides raw IQ samples
    this.socket = net.createConnection({ host: this.host, port: 1234 }); // rtl_tcp default port

    this.socket.on('data', (data) => {
      this.processIQData(data);
    });

    this.socket.on('error', (err) => {
      console.error('SDR connection error:', err);
    });
  }

  processIQData(data) {
    // rtl_tcp sends raw IQ samples as unsigned 8-bit integers
    // Convert to complex float samples
    const samples = new Float32Array(this.fftSize * 2);
    for (let i = 0; i < this.fftSize; i++) {
      samples[i * 2] = (data[i * 2] - 127.5) / 127.5;     // I (real)
      samples[i * 2 + 1] = (data[i * 2 + 1] - 127.5) / 127.5; // Q (imaginary)
    }

    // Perform FFT
    const out = this.fft.createComplexArray();
    this.fft.transform(out, samples);

    // Calculate power spectrum (magnitude squared)
    const spectrum = new Float32Array(this.fftSize / 2);
    for (let i = 0; i < this.fftSize / 2; i++) {
      const real = out[i * 2];
      const imag = out[i * 2 + 1];
      spectrum[i] = Math.sqrt(real * real + imag * imag);
    }

    // Convert to dBFS (decibels relative to full scale)
    const spectrumDb = spectrum.map(val => 20 * Math.log10(val + 1e-10));

    // Add to waterfall buffer
    this.waterfallBuffer.push(spectrumDb);
    if (this.waterfallBuffer.length > 100) {
      this.waterfallBuffer.shift(); // Keep last 100 lines
    }

    // Detect peaks (signals)
    this.detectSignals(spectrumDb);
  }

  detectSignals(spectrumDb) {
    const threshold = -40; // dBFS threshold for signal detection
    const bandwidth = this.currentBand ? this.calculateBandwidth(this.currentBand) : 2.4e6; // Hz
    const binWidth = bandwidth / this.fftSize;

    for (let i = 10; i < spectrumDb.length - 10; i++) {
      if (spectrumDb[i] > threshold) {
        // Check if this is a local maximum
        const isPeak = spectrumDb.slice(i - 5, i + 5).every((val, idx) => 
          idx === 5 || val <= spectrumDb[i]
        );

        if (isPeak) {
          const frequency = this.centerFreq + (i - this.fftSize / 2) * binWidth;
          this.signals.push({
            frequency: frequency / 1e6, // Convert to MHz
            signalStrength: spectrumDb[i],
            bandwidth: this.estimateBandwidth(spectrumDb, i, binWidth),
            timestamp: Date.now()
          });
        }
      }
    }

    // Remove duplicate signals (within 50 kHz)
    this.signals = this.deduplicateSignals(this.signals, 0.05); // 50 kHz tolerance
  }

  estimateBandwidth(spectrum, peakIndex, binWidth) {
    // Estimate 3dB bandwidth by finding points 3dB below peak
    const peakLevel = spectrum[peakIndex];
    const threshold3db = peakLevel - 3;

    let leftEdge = peakIndex;
    let rightEdge = peakIndex;

    while (leftEdge > 0 && spectrum[leftEdge] > threshold3db) leftEdge--;
    while (rightEdge < spectrum.length && spectrum[rightEdge] > threshold3db) rightEdge++;

    return (rightEdge - leftEdge) * binWidth;
  }

  deduplicateSignals(signals, toleranceMHz) {
    // Remove signals within tolerance of each other (keep strongest)
    const unique = [];
    signals.sort((a, b) => a.frequency - b.frequency);

    signals.forEach(sig => {
      const existing = unique.find(u => 
        Math.abs(u.frequency - sig.frequency) < toleranceMHz
      );
      if (!existing) {
        unique.push(sig);
      } else if (sig.signalStrength > existing.signalStrength) {
        const idx = unique.indexOf(existing);
        unique[idx] = sig;
      }
    });

    return unique;
  }

  async startScan(band) {
    this.currentBand = band;
    this.centerFreq = this.getBandCenterFreq(band);
    this.isScanning = true;

    // Send tuning command to rtl_tcp
    // rtl_tcp command format: [0x01][freq_hz as uint32_be]
    const tuneCmd = Buffer.alloc(5);
    tuneCmd.writeUInt8(0x01, 0);
    tuneCmd.writeUInt32BE(this.centerFreq, 1);
    this.socket.write(tuneCmd);
  }

  stopScan() {
    this.isScanning = false;
    this.signals = [];
    this.waterfallBuffer = [];
  }

  getBandCenterFreq(band) {
    const bands = {
      'cb': 27.185e6,           // 27.185 MHz (CB center)
      'airband': 121.5e6,       // 121.5 MHz (Airband center)
      'marine': 156.8e6,        // 156.8 MHz (Marine Ch 16)
      'noaa': 162.475e6,        // 162.475 MHz (NOAA center)
      'frs_gmrs': 462.5625e6,   // 462.5625 MHz (FRS/GMRS center)
      'ham_2m': 146e6,          // 146 MHz (Ham 2m center)
      'ham_70cm': 435e6         // 435 MHz (Ham 70cm center)
    };
    return bands[band] || 100e6;
  }

  calculateBandwidth(band) {
    const bandwidths = {
      'cb': 440e3,              // 440 kHz (40 channels * 10 kHz)
      'airband': 25e6,          // 25 MHz (full airband)
      'marine': 6e6,            // 6 MHz (Marine VHF)
      'noaa': 150e3,            // 150 kHz (7 channels)
      'frs_gmrs': 5e6,          // 5 MHz
      'ham_2m': 4e6,            // 4 MHz
      'ham_70cm': 30e6          // 30 MHz
    };
    return bandwidths[band] || 2.4e6;
  }

  getWaterfallData() {
    return this.waterfallBuffer;
  }

  getSignals() {
    // Remove signals older than 5 seconds
    const now = Date.now();
    this.signals = this.signals.filter(s => now - s.timestamp < 5000);
    return this.signals;
  }

  async detectDevices() {
    // Use SoapySDRUtil to enumerate devices
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec('SoapySDRUtil --find', (err, stdout, stderr) => {
        if (err) {
          reject(err);
          return;
        }
        // Parse output to extract device list
        const devices = this.parseDeviceList(stdout);
        resolve(devices);
      });
    });
  }

  parseDeviceList(output) {
    // Example output:
    // Found device 0
    //   driver = rtlsdr
    //   label = Generic RTL2832U :: 00000001
    const devices = [];
    const lines = output.split('\n');
    let currentDevice = null;

    lines.forEach(line => {
      if (line.includes('Found device')) {
        if (currentDevice) devices.push(currentDevice);
        currentDevice = {};
      } else if (line.includes('driver =')) {
        currentDevice.driver = line.split('=')[1].trim();
      } else if (line.includes('label =')) {
        currentDevice.label = line.split('=')[1].trim();
      }
    });

    if (currentDevice) devices.push(currentDevice);
    return devices;
  }
}

module.exports = new SDRClient();
```

**Alternative: rtl_tcp**
For MVP simplicity, we use `rtl_tcp` instead of SoapySDRServer:
```bash
rtl_tcp -a 127.0.0.1 -p 1234 -f 121500000 -s 2400000
```
- `-a`: Bind address
- `-p`: Port
- `-f`: Center frequency (Hz)
- `-s`: Sample rate (Hz)

**Performance:**
- FFT rate: 10 Hz (100ms per FFT)
- FFT size: 2048 bins
- Signal detection latency: <200ms

---

### 6. GPS Client

**File:** `backend/clients/gps-client.js`

**Purpose:** Read GPS position from gpsd daemon

**gpsd JSON Protocol:**
gpsd provides JSON output on TCP port 2947 (default).

**Example Messages:**
```json
{"class":"VERSION","release":"3.22","rev":"3.22","proto_major":3,"proto_minor":14}
{"class":"DEVICES","devices":[{"class":"DEVICE","path":"/dev/ttyUSB0","driver":"SiRF"}]}
{"class":"TPV","mode":3,"time":"2025-10-16T12:34:56.000Z","lat":37.7749,"lon":-122.4194,"alt":10.5,"speed":0.0}
```

**Implementation:**
```javascript
const net = require('net');

class GPSClient {
  constructor(host = '127.0.0.1', port = 2947) {
    this.host = host;
    this.port = port;
    this.position = null;
    this.hasFix = false;
    this.connect();
  }

  connect() {
    this.socket = net.createConnection({ host: this.host, port: this.port });

    this.socket.on('connect', () => {
      // Enable JSON reporting and watch for updates
      this.socket.write('?WATCH={"enable":true,"json":true}\n');
    });

    let buffer = '';
    this.socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      lines.forEach(line => {
        if (line.trim()) {
          try {
            const json = JSON.parse(line);
            if (json.class === 'TPV') {
              this.handleTPV(json);
            }
          } catch (err) {
            console.error('GPS parse error:', err);
          }
        }
      });
    });

    this.socket.on('error', (err) => {
      console.error('GPS connection error:', err);
      this.hasFix = false;
      setTimeout(() => this.connect(), 5000);
    });
  }

  handleTPV(tpv) {
    // TPV = Time-Position-Velocity
    if (tpv.mode >= 2 && tpv.lat && tpv.lon) {
      this.position = {
        lat: tpv.lat,
        lon: tpv.lon,
        altitude: tpv.alt || null,
        speed: tpv.speed || null,
        heading: tpv.track || null,
        time: tpv.time,
        mode: tpv.mode // 2=2D fix, 3=3D fix
      };
      this.hasFix = true;
    } else {
      this.hasFix = false;
    }
  }

  getPosition() {
    return this.position;
  }

  isConnected() {
    return this.socket && !this.socket.destroyed && this.hasFix;
  }
}

module.exports = new GPSClient();
```

**GPS Fix Modes:**
- Mode 0: No fix
- Mode 1: No fix (but gpsd is running)
- Mode 2: 2D fix (lat/lon only)
- Mode 3: 3D fix (lat/lon/altitude)

---

### 7. React Frontend (Electron Renderer)

**Directory:** `src/`

#### Component Hierarchy
```
App
├── StatusBar (GPS, DUMP1090, Kismet, SDR status)
├── MapView (MapLibre GL JS)
│   ├── AircraftLayer
│   ├── DroneLayer
│   └── UserLocationMarker
├── Dashboard
│   ├── AircraftStats
│   ├── DroneStats
│   ├── SignalStats
│   └── Controls (BandSelector, ScanButton, ExportButton)
└── WaterfallView (collapsible)
    ├── SpectrumCanvas
    └── WaterfallControls
```

#### Key Components

**App.jsx**
```javascript
import React, { useEffect, useState } from 'react';
import MapView from './components/MapView';
import Dashboard from './components/Dashboard';
import WaterfallView from './components/WaterfallView';
import StatusBar from './components/StatusBar';

function App() {
  const [wsData, setWsData] = useState({
    aircraft: [],
    drones: [],
    signals: [],
    gps: null
  });

  const [serviceStatus, setServiceStatus] = useState({
    dump1090: false,
    kismet: false,
    sdr: false,
    gps: false
  });

  useEffect(() => {
    // Connect to WebSocket
    const ws = new WebSocket('ws://localhost:3001');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setWsData(data);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    // Poll health endpoint
    const healthCheck = setInterval(async () => {
      const response = await fetch('http://localhost:3000/health');
      const status = await response.json();
      setServiceStatus(status);
    }, 5000);

    return () => {
      ws.close();
      clearInterval(healthCheck);
    };
  }, []);

  return (
    <div className="app">
      <StatusBar status={serviceStatus} />
      <MapView 
        aircraft={wsData.aircraft} 
        drones={wsData.drones}
        userPosition={wsData.gps}
      />
      <Dashboard 
        aircraft={wsData.aircraft}
        drones={wsData.drones}
        signals={wsData.signals}
      />
      <WaterfallView />
    </div>
  );
}

export default App;
```

**MapView.jsx**
```javascript
import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

function MapView({ aircraft, drones, userPosition }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef({
    aircraft: new Map(),
    drones: new Map(),
    user: null
  });

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json', // TODO: Replace with offline tiles
      center: [-122.4194, 37.7749], // Default: San Francisco
      zoom: 10
    });

    map.current.addControl(new maplibregl.NavigationControl());
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Update aircraft markers
    const currentAircraftIds = new Set(aircraft.map(ac => ac.icao));

    // Remove stale markers
    markers.current.aircraft.forEach((marker, icao) => {
      if (!currentAircraftIds.has(icao)) {
        marker.remove();
        markers.current.aircraft.delete(icao);
      }
    });

    // Add/update markers
    aircraft.forEach(ac => {
      if (ac.lat && ac.lon) {
        let marker = markers.current.aircraft.get(ac.icao);
        if (!marker) {
          const el = document.createElement('div');
          el.className = 'aircraft-marker';
          el.innerHTML = '✈️';
          marker = new maplibregl.Marker(el)
            .setLngLat([ac.lon, ac.lat])
            .setPopup(new maplibregl.Popup().setHTML(
              `<strong>${ac.callsign || ac.icao}</strong><br>
               Alt: ${ac.altitude} ft<br>
               Speed: ${ac.speed} kts`
            ))
            .addTo(map.current);
          markers.current.aircraft.set(ac.icao, marker);
        } else {
          marker.setLngLat([ac.lon, ac.lat]);
        }
      }
    });
  }, [aircraft]);

  useEffect(() => {
    if (!map.current) return;

    // Update drone markers (similar to aircraft)
    const currentDroneIds = new Set(drones.map(d => d.droneId));

    markers.current.drones.forEach((marker, id) => {
      if (!currentDroneIds.has(id)) {
        marker.remove();
        markers.current.drones.delete(id);
      }
    });

    drones.forEach(drone => {
      if (drone.droneLat && drone.droneLon) {
        let marker = markers.current.drones.get(drone.droneId);
        if (!marker) {
          const el = document.createElement('div');
          el.className = 'drone-marker';
          el.innerHTML = '🚁';
          marker = new maplibregl.Marker(el)
            .setLngLat([drone.droneLon, drone.droneLat])
            .setPopup(new maplibregl.Popup().setHTML(
              `<strong>Drone: ${drone.manufacturer || 'Unknown'}</strong><br>
               Alt: ${drone.droneAltitude} m<br>
               Operator: ${drone.operatorLat ? `${drone.operatorLat.toFixed(5)}, ${drone.operatorLon.toFixed(5)}` : 'Unknown'}`
            ))
            .addTo(map.current);
          markers.current.drones.set(drone.droneId, marker);
        } else {
          marker.setLngLat([drone.droneLon, drone.droneLat]);
        }

        // Draw line to operator if available
        if (drone.operatorLat && drone.operatorLon) {
          // TODO: Use map.addLayer to draw line
        }
      }
    });
  }, [drones]);

  useEffect(() => {
    if (!map.current || !userPosition) return;

    // Update user position marker
    if (!markers.current.user) {
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.innerHTML = '📍';
      markers.current.user = new maplibregl.Marker(el, { color: '#007cbf' })
        .setLngLat([userPosition.lon, userPosition.lat])
        .addTo(map.current);
    } else {
      markers.current.user.setLngLat([userPosition.lon, userPosition.lat]);
    }

    // Center map on user (only on first fix)
    if (!map.current.hasUserCentered) {
      map.current.flyTo({ center: [userPosition.lon, userPosition.lat], zoom: 12 });
      map.current.hasUserCentered = true;
    }
  }, [userPosition]);

  return <div ref={mapContainer} className="map-container" style={{ width: '100%', height: '400px' }} />;
}

export default MapView;
```

**Dashboard.jsx**
```javascript
import React from 'react';

function Dashboard({ aircraft, drones, signals }) {
  const aircraftByType = {
    commercial: aircraft.filter(ac => ac.callsign && /[A-Z]{3}\d{1,4}/.test(ac.callsign)).length,
    private: aircraft.length - aircraft.filter(ac => ac.callsign && /[A-Z]{3}\d{1,4}/.test(ac.callsign)).length
  };

  const dronesByManufacturer = drones.reduce((acc, drone) => {
    const mfg = drone.manufacturer || 'Unknown';
    acc[mfg] = (acc[mfg] || 0) + 1;
    return acc;
  }, {});

  const signalsByBand = signals.reduce((acc, sig) => {
    const band = sig.bandName || 'Unknown';
    acc[band] = (acc[band] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="dashboard">
      <div className="stat-panel">
        <h3>Aircraft Detected</h3>
        <div className="stat-value">{aircraft.length}</div>
        <div className="stat-details">
          ✈️ Commercial: {aircraftByType.commercial}<br />
          🛩️ Private: {aircraftByType.private}
        </div>
      </div>

      <div className="stat-panel">
        <h3>Drones Detected</h3>
        <div className="stat-value">{drones.length}</div>
        <div className="stat-details">
          {Object.entries(dronesByManufacturer).map(([mfg, count]) => (
            <div key={mfg}>🚁 {mfg}: {count}</div>
          ))}
        </div>
      </div>

      <div className="stat-panel">
        <h3>RF Signals Active</h3>
        <div className="stat-value">{signals.length}</div>
        <div className="stat-details">
          {Object.entries(signalsByBand).map(([band, count]) => (
            <div key={band}>📻 {band}: {count}</div>
          ))}
        </div>
      </div>

      <div className="control-panel">
        <h3>Controls</h3>
        <label>Active Band:</label>
        <select id="band-select">
          <option value="airband">Airband</option>
          <option value="marine">Marine VHF</option>
          <option value="noaa">NOAA Weather</option>
          <option value="frs_gmrs">FRS/GMRS</option>
          <option value="cb">CB</option>
          <option value="ham_2m">Ham 2m</option>
          <option value="ham_70cm">Ham 70cm</option>
        </select>
        <button id="scan-btn">▶ Scan</button>
        <button id="export-btn">💾 Export</button>
      </div>
    </div>
  );
}

export default Dashboard;
```

**WaterfallView.jsx**
```javascript
import React, { useEffect, useRef, useState } from 'react';

function WaterfallView() {
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [waterfallData, setWaterfallData] = useState([]);

  useEffect(() => {
    if (!isScanning) return;

    // Poll for waterfall data
    const interval = setInterval(async () => {
      const response = await fetch('http://localhost:3000/api/waterfall');
      const data = await response.json();
      setWaterfallData(data.waterfall);
    }, 100); // 10 Hz

    return () => clearInterval(interval);
  }, [isScanning]);

  useEffect(() => {
    if (!canvasRef.current || waterfallData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Draw waterfall (each row is one FFT)
    const rowHeight = height / waterfallData.length;
    waterfallData.forEach((row, rowIndex) => {
      const y = rowIndex * rowHeight;
      row.forEach((value, colIndex) => {
        const x = (colIndex / row.length) * width;
        const color = valueToColor(value); // Map dB value to color
        ctx.fillStyle = color;
        ctx.fillRect(x, y, width / row.length, rowHeight);
      });
    });
  }, [waterfallData]);

  function valueToColor(dbValue) {
    // Map dB value (-100 to 0) to color (blue to red)
    const normalized = Math.max(0, Math.min(1, (dbValue + 100) / 100));
    const hue = (1 - normalized) * 240; // 240 = blue, 0 = red
    return `hsl(${hue}, 100%, 50%)`;
  }

  async function toggleScan() {
    if (isScanning) {
      await fetch('http://localhost:3000/api/scan/stop', { method: 'POST' });
      setIsScanning(false);
    } else {
      const band = document.getElementById('band-select').value;
      await fetch('http://localhost:3000/api/scan/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ band })
      });
      setIsScanning(true);
    }
  }

  return (
    <div className="waterfall-view">
      <h3>▼ Waterfall View</h3>
      <canvas ref={canvasRef} width={1200} height={300} />
      <button onClick={toggleScan}>
        {isScanning ? '■ Stop' : '▶ Start Scan'}
      </button>
    </div>
  );
}

export default WaterfallView;
```

---

## External Dependencies

### Service Configuration

#### DUMP1090 Configuration
**File:** `/etc/default/dump1090-mutability`
```bash
# Enable network output
NET_OPTIONS="--net --net-sbs-port 30003 (SBS text feed)"

# Receiver options
RECEIVER_OPTIONS="--gain -10 --ppm 0"

# Latitude/Longitude for range circles (optional)
LAT=37.7749
LON=-122.4194
```

**Systemd Service:**
```bash
sudo systemctl enable dump1090-mutability
sudo systemctl start dump1090-mutability
```

#### Kismet Configuration
**File:** `/etc/kismet/kismet.conf` or `~/.kismet/kismet.conf`
```
# Bluetooth data source
source=hci0:name=BluetoothAdapter

# Enable REST API
httpd_port=2501
httpd_username=kismet
httpd_password=kismet

# Log settings (optional - disable to save disk)
log_types=

# Remote ID plugin (if available)
# Check Kismet documentation for Remote ID support in your version
```

**Start Kismet (headless):**
```bash
kismet --daemonize --silent
```

**User must be in kismet group:**
```bash
sudo usermod -aG kismet $USER
```

#### gpsd Configuration
**File:** `/etc/default/gpsd`
```bash
# Start gpsd automatically
START_DAEMON="true"

# Devices to monitor
DEVICES="/dev/ttyUSB0"  # Adjust based on GPS dongle

# gpsd options
GPSD_OPTIONS="-n"  # -n = don't wait for client to connect before polling

# Socket
GPSD_SOCKET="/var/run/gpsd.sock"
```

**Auto-start:**
```bash
sudo systemctl enable gpsd
sudo systemctl start gpsd
```

#### SoapySDR (Deferred to vNext) / rtl_tcp
For MVP, use `rtl_tcp` which is part of `rtl-sdr` package:
```bash
# No configuration file needed
# Start manually or via backend:
rtl_tcp -a 127.0.0.1 -p 1234
```

---

## API Contracts

### Backend REST API

#### GET /health
**Description:** Health check for all external services

**Response:**
```json
{
  "dump1090": true,
  "kismet": true,
  "sdr": true,
  "gps": true,
  "uptime": 3600
}
```

#### GET /api/devices
**Description:** List detected SDR devices

**Response:**
```json
{
  "devices": [
    {
      "driver": "rtlsdr",
      "label": "Generic RTL2832U :: 00000001",
      "index": 0
    },
    {
      "driver": "hackrf",
      "label": "HackRF One",
      "index": 1
    }
  ],
  "selected": 0
}
```

#### POST /api/scan/start
**Description:** Start spectrum scanning

**Request Body:**
```json
{
  "band": "airband",
  "device": 0
}
```

**Response:**
```json
{
  "success": true,
  "centerFreq": 121500000,
  "bandwidth": 25000000
}
```

#### POST /api/scan/stop
**Description:** Stop spectrum scanning

**Response:**
```json
{
  "success": true
}
```

#### GET /api/waterfall
**Description:** Get current waterfall buffer

**Response:**
```json
{
  "waterfall": [
    [-80, -75, -70, -65, ...],  // Array of dB values
    [-81, -76, -71, -66, ...],
    ...
  ],
  "centerFreq": 121500000,
  "bandwidth": 2400000
}
```

#### POST /api/export
**Description:** Export session data to CSV

**Request Body:**
```json
{
  "path": "/home/user/exports/"
}
```

**Response:**
```json
{
  "success": true,
  "files": [
    "/home/user/exports/aircraft_20251016_123456.csv",
    "/home/user/exports/drones_20251016_123456.csv",
    "/home/user/exports/rf_signals_20251016_123456.csv"
  ]
}
```

### WebSocket Protocol

**Endpoint:** `ws://localhost:3001`

**Message Format (Server → Client):**
```json
{
  "aircraft": [
    {
      "icao": "a12345",
      "callsign": "UAL123",
      "altitude": 35000,
      "speed": 450,
      "heading": 270,
      "lat": 37.7749,
      "lon": -122.4194,
      "lastSeen": 1697452800000
    }
  ],
  "drones": [
    {
      "droneId": "DJI-ABC123",
      "manufacturer": "DJI",
      "droneLat": 37.7750,
      "droneLon": -122.4195,
      "droneAltitude": 50,
      "operatorLat": 37.7748,
      "operatorLon": -122.4193,
      "speed": 5.5,
      "heading": 180
    }
  ],
  "signals": [
    {
      "frequency": 121.5,
      "signalStrength": -35,
      "bandwidth": 8000,
      "bandName": "Airband"
    }
  ],
  "gps": {
    "lat": 37.7749,
    "lon": -122.4194,
    "altitude": 10.5,
    "mode": 3
  },
  "timestamp": 1697452800000
}
```

**Update Rate:** 1 Hz (1000ms interval)

---

## Database Schema

### SQLite Database: `rfscanner.db`

#### Table: aircraft
```sql
CREATE TABLE aircraft (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icao TEXT UNIQUE NOT NULL,
    callsign TEXT,
    altitude INTEGER,
    speed INTEGER,
    heading INTEGER,
    lat REAL,
    lon REAL,
    vertical_rate INTEGER,
    squawk TEXT,
    last_seen INTEGER,  -- Unix timestamp (ms)
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_aircraft_icao ON aircraft(icao);
CREATE INDEX idx_aircraft_last_seen ON aircraft(last_seen);
```

#### Table: drones
```sql
CREATE TABLE drones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drone_id TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    drone_lat REAL,
    drone_lon REAL,
    drone_altitude REAL,
    operator_lat REAL,
    operator_lon REAL,
    operator_altitude REAL,
    speed REAL,
    heading INTEGER,
    height_agl REAL,
    timestamp_accuracy INTEGER,
    last_seen INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_drones_drone_id ON drones(drone_id);
CREATE INDEX idx_drones_last_seen ON drones(last_seen);
```

#### Table: rf_signals
```sql
CREATE TABLE rf_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frequency_mhz REAL NOT NULL,
    bandwidth_hz INTEGER,
    signal_strength REAL,
    modulation TEXT,
    band_name TEXT,
    device_lat REAL,
    device_lon REAL,
    timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_signals_frequency ON rf_signals(frequency_mhz);
CREATE INDEX idx_signals_band ON rf_signals(band_name);
CREATE INDEX idx_signals_timestamp ON rf_signals(timestamp);
```

#### Table: user_settings (persistent)
```sql
CREATE TABLE user_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Default settings
INSERT OR IGNORE INTO user_settings (key, value) VALUES
  ('distance_unit', 'miles'),
  ('default_band', 'airband'),
  ('map_zoom', '10'),
  ('map_center_lat', '37.7749'),
  ('map_center_lon', '-122.4194');
```

### Database Operations

**Initialize Database:**
```javascript
const Database = require('better-sqlite3');
const db = new Database('rfscanner.db');

// Run schema
db.exec(fs.readFileSync('schema.sql', 'utf8'));
```

**Insert Aircraft:**
```javascript
const stmt = db.prepare(`
  INSERT OR REPLACE INTO aircraft 
  (icao, callsign, altitude, speed, heading, lat, lon, vertical_rate, squawk, last_seen)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

stmt.run(
  aircraft.icao,
  aircraft.callsign,
  aircraft.altitude,
  aircraft.speed,
  aircraft.heading,
  aircraft.lat,
  aircraft.lon,
  aircraft.verticalRate,
  aircraft.squawk,
  Date.now()
);
```

**Clear Session Data:**
```javascript
db.exec('DELETE FROM aircraft');
db.exec('DELETE FROM drones');
db.exec('DELETE FROM rf_signals');
```

**Export to CSV:**
```javascript
const fs = require('fs');

function exportAircraft(outputPath) {
  const rows = db.prepare('SELECT * FROM aircraft ORDER BY last_seen DESC').all();
  const csv = [
    'ICAO,Callsign,Altitude,Speed,Heading,Latitude,Longitude,LastSeen',
    ...rows.map(r => `${r.icao},${r.callsign},${r.altitude},${r.speed},${r.heading},${r.lat},${r.lon},${new Date(r.last_seen).toISOString()}`)
  ].join('\n');
  fs.writeFileSync(outputPath, csv);
}
```

---

## File Structure

```
onthego-scanner/
├── electron/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Context bridge (IPC)
│   └── icon.png             # App icon
├── backend/
│   ├── server.js            # Fastify HTTP + WebSocket server
│   ├── database.js          # SQLite wrapper
│   ├── clients/
│   │   ├── dump1090-client.js
│   │   ├── kismet-client.js
│   │   ├── sdr-client.js
│   │   └── gps-client.js
│   ├── routes/
│   │   ├── health.js        # GET /health
│   │   ├── devices.js       # GET /api/devices
│   │   ├── scan.js          # POST /api/scan/*
│   │   └── export.js        # POST /api/export
│   └── utils/
│       ├── logger.js
│       └── bandplan.js
├── src/                     # React frontend
│   ├── App.jsx
│   ├── components/
│   │   ├── MapView.jsx
│   │   ├── Dashboard.jsx
│   │   ├── WaterfallView.jsx
│   │   ├── StatusBar.jsx
│   │   └── DetailPanels/
│   │       ├── AircraftDetail.jsx
│   │       └── DroneDetail.jsx
│   ├── styles/
│   │   ├── App.css
│   │   └── components.css
│   └── utils/
│       └── formatters.js    # Distance, speed, altitude formatters
├── resources/
│   ├── bandplan_us.json     # Hardcoded US band plan
│   ├── offline_map.mbtiles  # Offline map tiles (future)
│   └── icons/
│       ├── aircraft.svg
│       ├── drone.svg
│       └── user.svg
├── scripts/
│   ├── setup.sh             # Installation script
│   └── build.sh             # Production build script
├── tests/
│   ├── backend/
│   │   ├── dump1090-client.test.js
│   │   ├── kismet-client.test.js
│   │   └── database.test.js
│   └── frontend/
│       └── MapView.test.jsx
├── docs/
│   ├── PRD_v2.md
│   ├── TRD_v2.md (this document)
│   └── USER_GUIDE.md
├── package.json
├── package-lock.json
├── webpack.config.js
├── .gitignore
├── README.md
└── LICENSE
```

---

## Build & Deployment

### Development Setup

**Prerequisites:**
- Node.js 18 LTS
- npm 9+
- System dependencies (installed via setup.sh)

**Install Node Dependencies:**
```bash
npm install
```

**Start Development Server:**
```bash
# Terminal 1: Backend
npm run backend

# Terminal 2: Frontend (webpack dev server)
npm run frontend

# Terminal 3: Electron
npm run electron:dev
```

### Production Build

**Build Electron App:**
```bash
npm run build
```

This runs:
1. Webpack production build (frontend → `dist/`)
2. electron-builder (creates .deb, AppImage)

**Output:**
```
dist/
├── OnTheGoScanner_1.0.0_amd64.deb
└── OnTheGoScanner-1.0.0.AppImage
```

### Package.json Scripts

```json
{
  "name": "onthego-scanner",
  "version": "1.0.0",
  "main": "electron/main.js",
  "scripts": {
    "backend": "node backend/server.js",
    "frontend": "webpack serve --config webpack.config.js --mode development",
    "electron:dev": "electron .",
    "build": "webpack --config webpack.config.js --mode production && electron-builder",
    "test": "jest",
    "lint": "eslint src/ backend/"
  },
  "dependencies": {
    "fastify": "^4.24.0",
    "ws": "^8.14.0",
    "better-sqlite3": "^9.0.0",
    "node-fetch": "^3.3.0",
    "fft.js": "^4.0.4",
    "winston": "^3.11.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "maplibre-gl": "^3.6.0"
  },
  "devDependencies": {
    "electron": "^28.0.0",
    "electron-builder": "^24.6.0",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "webpack-dev-server": "^4.15.0",
    "@babel/core": "^7.23.0",
    "@babel/preset-react": "^7.22.0",
    "babel-loader": "^9.1.3",
    "css-loader": "^6.8.1",
    "style-loader": "^3.3.3",
    "jest": "^29.7.0",
    "eslint": "^8.52.0"
  },
  "build": {
    "appId": "com.onthego.scanner",
    "productName": "OnTheGo Scanner",
    "files": [
      "dist/**/*",
      "electron/**/*",
      "backend/**/*",
      "resources/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "linux": {
      "target": ["deb", "AppImage"],
      "category": "Utility"
    }
  }
}
```

---

## Development Environment

### Recommended IDE: VS Code

**Extensions:**
- ESLint
- Prettier
- JavaScript Debugger
- React Developer Tools

**VS Code Launch Configuration (.vscode/launch.json):**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "args": ["."],
      "outputCapture": "std"
    },
    {
      "name": "Backend Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/backend/server.js",
      "console": "integratedTerminal"
    }
  ]
}
```

### Code Style

**ESLint Config (.eslintrc.json):**
```json
{
  "env": {
    "browser": true,
    "node": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 12,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off"
  }
}
```

---

## Testing Strategy

### Unit Tests (Jest)

**Backend Tests:**
```javascript
// tests/backend/dump1090-client.test.js
const DUMP1090Client = require('../../backend/clients/dump1090-client');

describe('DUMP1090Client', () => {
  test('parses aircraft JSON correctly', () => {
    const json = {
      aircraft: [
        {
          hex: 'a12345',
          flight: 'UAL123  ',
          lat: 37.7749,
          lon: -122.4194,
          altitude: 35000
        }
      ]
    };
    
    // Simulate receiving data
    const parsed = DUMP1090Client.parseAircraftJSON(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].icao).toBe('a12345');
    expect(parsed[0].callsign).toBe('UAL123');
  });

  test('removes stale aircraft', () => {
    // Add aircraft
    DUMP1090Client.aircraft.set('a12345', {
      icao: 'a12345',
      lastSeen: Date.now() - 70000 // 70 seconds ago
    });

    const active = DUMP1090Client.getAircraft();
    expect(active).toHaveLength(0); // Should be removed (60s timeout)
  });
});
```

**Frontend Tests:**
```javascript
// tests/frontend/MapView.test.jsx
import { render, screen } from '@testing-library/react';
import MapView from '../../src/components/MapView';

describe('MapView', () => {
  test('renders map container', () => {
    render(<MapView aircraft={[]} drones={[]} userPosition={null} />);
    expect(screen.getByClassName('map-container')).toBeInTheDocument();
  });

  test('displays aircraft markers', () => {
    const aircraft = [
      { icao: 'a12345', callsign: 'UAL123', lat: 37.7749, lon: -122.4194 }
    ];
    render(<MapView aircraft={aircraft} drones={[]} userPosition={null} />);
    // Verify marker is rendered (requires mocking MapLibre)
  });
});
```

### Integration Tests

**Test External Service Connections:**
```bash
# Test DUMP1090 connectivity
curl http://localhost:30003 (SBS text feed)

# Test Kismet REST API
curl http://localhost:2501/system/status.json

# Test gpsd
gpspipe -w -n 5
```

### Manual Testing Checklist

**Pre-Release QA:**
- [ ] Install on clean Ubuntu 20.04 VM
- [ ] Run setup.sh and verify all services start
- [ ] Plug in RTL-SDR, verify detection
- [ ] Plug in GPS dongle, verify position on map
- [ ] Start DUMP1090, verify aircraft appear on map
- [ ] Start Kismet, verify Bluetooth monitoring active
- [ ] Scan airband, verify waterfall displays
- [ ] Export data, verify CSV files created
- [ ] Close app, verify database cleared
- [ ] Re-open app, verify no old data present
- [ ] Test with HackRF device
- [ ] Test on Debian 11 system

---

## Performance Optimization

### Frontend Performance

**React Optimization:**
- Use `React.memo()` for expensive components (MapView, WaterfallView)
- Debounce WebSocket updates (batch state updates)
- Virtualize long lists (aircraft/drone lists >100 items)

**MapLibre Optimization:**
- Cluster markers when >50 aircraft visible
- Reduce marker detail when zoomed out
- Lazy load map tiles

**Waterfall Optimization:**
- Use OffscreenCanvas for FFT rendering (if supported)
- Limit waterfall buffer to 100 lines (10 seconds at 10 Hz)
- Throttle canvas redraws to 30 FPS max

### Backend Performance

**Node.js Optimization:**
- Use worker threads for FFT processing (prevents blocking main thread)
- Connection pooling for external services (reuse sockets)
- LRU cache for frequently accessed data (bandplan lookup)

**Database Optimization:**
- Prepared statements for repeated queries
- Indexes on frequently queried columns (last_seen, frequency)
- Batch inserts (insert 10 signals at once, not individually)

### Memory Management

**Target Memory Usage:**
- Electron Main: <150 MB
- Electron Renderer: <300 MB
- Node.js Backend: <200 MB
- **Total:** <650 MB

**Memory Leak Prevention:**
- Clear interval timers on component unmount
- Remove event listeners when sockets close
- Limit buffer sizes (waterfall, signals)

---

## Security Considerations

### Network Security

**Localhost Only:**
All services bind to `127.0.0.1` (not `0.0.0.0`) to prevent external access.

**No Remote Access in MVP:**
WebSocket server only accepts connections from localhost. Future versions may add authentication for remote monitoring.

### Data Privacy

**No Telemetry:**
App does not send any data to external servers. All processing is local.

**Session-Only Storage:**
Sensitive RF data (signals, aircraft, drones) is cleared on exit. Only user settings persist.

**Export Security:**
User explicitly chooses export location. No automatic cloud uploads.

### Code Security

**Electron Context Isolation:**
Renderer process has no direct Node.js access. All IPC goes through preload script.

**Input Validation:**
Sanitize all user inputs (CSV imports, frequency inputs, etc.)

**Dependency Auditing:**
Run `npm audit` regularly to check for vulnerable dependencies.

---

## Appendix A: bandplan_us.json

```json
{
  "version": "1.0",
  "bands": [
    {
      "name": "CB",
      "label": "Citizens Band",
      "start_mhz": 26.965,
      "end_mhz": 27.405,
      "mode": "AM/SSB",
      "channels": 40,
      "notes": "Channel 9 is emergency, Channel 19 is truckers"
    },
    {
      "name": "airband",
      "label": "Airband (Aviation)",
      "start_mhz": 108.0,
      "end_mhz": 137.0,
      "mode": "AM",
      "channels": 760,
      "notable_frequencies": [
        {"freq": 121.5, "label": "Emergency"},
        {"freq": 122.8, "label": "Unicom"},
        {"freq": 123.45, "label": "Air-to-air"}
      ]
    },
    {
      "name": "ham_2m",
      "label": "Ham Radio 2m (VHF)",
      "start_mhz": 144.0,
      "end_mhz": 148.0,
      "mode": "FM/SSB/CW",
      "notable_frequencies": [
        {"freq": 146.52, "label": "National Simplex Calling"}
      ]
    },
    {
      "name": "marine",
      "label": "Marine VHF",
      "start_mhz": 156.0,
      "end_mhz": 162.0,
      "mode": "FM",
      "channels": 55,
      "notable_frequencies": [
        {"freq": 156.8, "label": "Channel 16 (Emergency)"},
        {"freq": 157.1, "label": "Channel 22A (Coast Guard)"}
      ]
    },
    {
      "name": "noaa",
      "label": "NOAA Weather Radio",
      "start_mhz": 162.4,
      "end_mhz": 162.55,
      "mode": "FM",
      "channels": 7,
      "frequencies": [162.400, 162.425, 162.450, 162.475, 162.500, 162.525, 162.550]
    },
    {
      "name": "ham_70cm",
      "label": "Ham Radio 70cm (UHF)",
      "start_mhz": 420.0,
      "end_mhz": 450.0,
      "mode": "FM/SSB/Digital",
      "notable_frequencies": [
        {"freq": 446.0, "label": "National Simplex Calling"}
      ]
    },
    {
      "name": "frs_gmrs",
      "label": "FRS/GMRS",
      "start_mhz": 462.5625,
      "end_mhz": 467.7125,
      "mode": "FM (Narrowband)",
      "channels": 30,
      "notes": "Family Radio Service / General Mobile Radio Service"
    }
  ]
}
```

---

## Appendix B: Setup Script Details

See `setup.sh` in separate file (next deliverable).

Key steps:
1. Update apt repositories
2. Install system dependencies
3. Install Node.js (via NodeSource)
4. Install DUMP1090, Kismet, SoapySDR (Deferred to vNext), gpsd
5. Configure user groups
6. Create systemd service files (optional)
7. Install npm dependencies for app

---

## Appendix C: Troubleshooting Guide

### Common Issues

**DUMP1090 Not Connecting:**
- Check if service is running: `sudo systemctl status dump1090-mutability`
- Check port: `nc -zv 127.0.0.1 30003 (SBS text feed)`
- View logs: `sudo journalctl -u dump1090-mutability -f`

**Kismet Not Detecting Remote ID:**
- Verify Bluetooth is enabled: `bluetoothctl power on`
- Check Kismet data source: `kismet -c hci0`
- Ensure Kismet version is 2022+: `kismet --version`

**RTL-SDR Not Detected:**
- Check USB connection: `lsusb | grep RTL`
- Test with rtl_test: `rtl_test -t`
- Verify driver: `SoapySDRUtil --find="driver=rtlsdr"`

**GPS No Fix:**
- Check device: `ls /dev/ttyUSB*` or `ls /dev/ttyACM*`
- Test gpsd: `gpspipe -w -n 5`
- Verify outdoor line-of-sight to sky

**WebSocket Connection Failed:**
- Check backend is running: `curl http://localhost:3000/health`
- Check port not in use: `lsof -i :3001`
- Check firewall: `sudo ufw status`

---

## Appendix D: Performance Benchmarks

### Target Benchmarks (MVP)

| Metric | Target | Test Scenario |
|--------|--------|---------------|
| App Startup | <10s | Cold start on Core i5-6200U |
| Map Update Latency | <2s | Aircraft detection to map display |
| Waterfall Frame Rate | 10 Hz | 2048-point FFT, Airband |
| CPU Usage (Idle) | <10% | Services running, no scan |
| CPU Usage (Scanning) | <50% | Active waterfall + aircraft tracking |
| RAM Usage | <650 MB | All components active |
| Aircraft Capacity | 100+ | Without frame drops |
| Drone Capacity | 20+ | Simultaneous Remote ID beacons |

### Profiling Tools

**Backend:**
```bash
node --inspect backend/server.js
# Open chrome://inspect in Chrome
```

**Frontend:**
- React DevTools (Profiler tab)
- Chrome DevTools (Performance tab)

**Database:**
```javascript
db.pragma('query_only = ON');
db.pragma('temp_store = MEMORY');
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-15 | Original | Initial TRD with Python/Flutter stack |
| 2.0 | 2025-10-16 | Revised | Complete rewrite: Electron/Node.js/React stack, detailed API specs, component implementations, SoapySDR (Deferred to vNext)/rtl_tcp integration, Kismet Remote ID parsing |

---

**END OF TRD v2.0**


**MVP Choice:** Standardize on `rtl_tcp:1234` for SDR transport. SoapySDR integration is deferred to vNext.


### Remote ID Implementation Notes

- **Feature detection:** On startup, probe Kismet `/system/plugins.json` and relevant device endpoints. Gate UI features accordingly.
- **Fallback parsing:** If parsed Remote ID fields are unavailable, enable a fallback path that parses raw BLE advertisements for OpenDroneID frames, or call into `opendroneid-core-c` via a tiny helper process.
- **Operator location:** Treat pilot/operator location as optional; display with a dotted icon and “if available” tooltip with “last seen” age.
- **Standards:** Target ASTM **F3411-22a**. Support Basic ID, Location/Vector, System, Operator ID, and Authentication (display-only if present).


### FFT & Waterfall Performance

- Move FFT to a **Web Worker** and post back `Float32Array` magnitudes; avoid JSON overhead.
- Default `fftSize` **1024** at **5 Hz** on low-end hardware; make rate/size configurable.
- Keep telemetry (aircraft/drone lists) at 1 Hz on a separate channel.


### Security Hardening

- Bind local services to `127.0.0.1` (gpsd without `-G`, Kismet `httpd_host=127.0.0.1`).
- Electron windows: `nodeIntegration: false`, `contextIsolation: true`.
- Add a Content Security Policy: `default-src 'self'; img-src 'self' blob:; connect-src 'self' http://127.0.0.1:*; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'`.


### Health Checks (Reality-based)

- **dump1090:** GET `/data/aircraft.json` and parse JSON.
- **Kismet:** GET `/system/status.json`; treat 404/feature-missing as “unavailable” and degrade gracefully.
- **SDR:** Connect to `rtl_tcp:1234` and read banner within timeout.


### Dependency Matrix & Degradation

- **All services:** SDR + GPS + ADS-B + RID → full dashboard.
- **RF-only:** SDR + ADS-B; map centers on last fix/manual center.
- **Localize-only:** GPS + RID; no SDR spectrum.
- **Offline demo:** mock feeds (files) for training/tests.


### Memory Budget

Target ~**1 GB** for Electron + MapLibre + FFT. Add a “Performance mode” that caps markers, waterfall rows, and tile density.


### Robust WebSockets

Implement exponential backoff reconnection with jitter for UI ↔ backend sockets.


### Cleanup on Exit

Add `before-quit` hooks to stop scans, close sockets, and purge temporary DB tables if “cleared on exit” is promised. Handle abnormal exits (`SIGTERM`, `uncaughtException`).


### Band Plan Caveats

- RTL-SDR usable sample rate ≈ 2.4 MS/s; implement **stepped-sweep** for wide bands.
- Sensitivity below ~50 MHz is reduced; CB (27 MHz) may require upconverter or v4-class dongle for best results.
- Strong-signal environments may need front-end filtering/attenuation.


## Input Validation & Resource Limits

**Input Validation**  
All external data must be validated before use:
- ICAO hex: `/^[a-f0-9]{6}$/i`
- Latitude ∈ [-90, 90], Longitude ∈ [-180, 180]
- Clamp altitude/speed/headings to sane bounds
- Reject/ignore malformed objects

**Resource Limits (defaults; configurable):**
- MAX_AIRCRAFT = 500
- MAX_DRONES = 100
- MAX_SIGNALS = 1000
- WATERFALL_ROWS = 100



## DUMP1090 Interface (HTTP JSON)

**DUMP1090 Interface (HTTP JSON)**  
- Standardize on polling `http://127.0.0.1:8080/data/aircraft.json` at **1 Hz**.  
- Port **30003** is **SBS text** (optional; requires a line parser).  
- Health Check: GET `/data/aircraft.json` → 200 + JSON parse.



## FFT & Waterfall Performance and Memory

**FFT & Waterfall Performance and Memory**  
- Compute FFT in a **Web Worker**; pass `Float32Array` magnitudes (no JSON).  
- Default `fftSize` **1024** and **5 Hz** on low-end hardware; **target ≥10 Hz** on capable systems (user-tunable).  
- Use a **fixed-size circular buffer** for waterfall rows to cap memory (e.g., 100 rows).  



## GPS Manual Fallback

**GPS Manual Fallback**  
- If gpsd has no fix (indoors), allow a **manual position** (lat, lon) used until a real fix arrives.



## Progressive Loading & Friendly Error Recovery

**Progressive Loading & Friendly Error Recovery**  
- Show map immediately with cached tiles; then connect services; then start data streams.  
- Present human-readable error panels with suggested actions (e.g., “Start dump1090 service”).  
- Provide action buttons (Retry, Start Service, Open Troubleshooting) where feasible.



## Resilient WebSockets

**Resilient WebSockets**  
- Implement exponential backoff + jitter for reconnects; reset delay on successful open.  



## Database Batching Policy

**Database Batching Policy**  
- Batch inserts (e.g., groups of 100) using a transaction wrapper; flush every 5s or at limit.  



## Mock Mode (No Hardware Development)

**Mock Mode (No Hardware Development)**  
- `USE_MOCK_DATA=true` to enable mock generators for aircraft, drones, signals, and GPS.  
- Provide `npm` scripts for doctor/perf tests (`test:services`, `test:mock`, `test:perf`, `doctor`).  



## Testing Checklist (Minimum Coverage)

**Testing Checklist (Minimum Coverage)**  
- No hardware connected (mock only)  
- RTL-SDR only  
- RTL-SDR + GPS  
- Indoors (no GPS fix)  
- 100+ aircraft load  
- 1+ hour soak (memory leaks)  
- Malformed DUMP1090 data  
- Service crash & recovery  
- Export with large dataset  
- Minimum-spec hardware

