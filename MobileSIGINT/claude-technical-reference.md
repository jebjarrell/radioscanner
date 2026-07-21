# Mobile SIGINT Platform - Technical Reference for Claude

**Complete Technical Requirements & Specifications**
**Version 1.0 | January 2026**

This document contains the complete technical specifications for the Mobile SIGINT Platform. Use this as the authoritative reference when implementing features, writing tests, or making architectural decisions.

---

## Table of Contents

1. [Functional Requirements](#functional-requirements)
2. [Non-Functional Requirements](#non-functional-requirements)
3. [API Specifications](#api-specifications)
4. [Hardware Specifications](#hardware-specifications)
5. [Testing Requirements](#testing-requirements)
6. [Security Requirements](#security-requirements)

---

## Functional Requirements

### FR-100: Scanner Control System

The scanner control system provides a touch-optimized interface for the Uniden BCD996P2 scanner, designed for safe operation while driving.

**FR-101**: System shall communicate with BCD996P2 via USB serial at 9600 baud

**FR-102**: System shall display current frequency in large, high-contrast format (minimum 12vw font)

**FR-103**: System shall display system name and channel name for trunked systems

**FR-104**: System shall provide touch targets minimum 48x48 pixels for all controls

**FR-105**: System shall support Hold, Scan, and Lockout functions via touch interface

**FR-106**: System shall maintain channel history (minimum 50 entries) with timestamps

**FR-107**: System shall provide one-button handoff to KrakenSDR for direction finding

**FR-108**: System shall auto-start on boot and run in kiosk mode

#### Scanner Serial Protocol Reference

```python
# Common scanner commands (Uniden BCD996P2)
COMMANDS = {
    'STATUS': 'STS',           # Get scanner status
    'GET_FREQ': 'GLG',         # Get current frequency (returns: GLG,154.4300)
    'HOLD': 'KEY,H',           # Hold on current frequency
    'SCAN': 'KEY,S',           # Resume scanning
    'LOCKOUT': 'KEY,L',        # Lockout current channel
    'GET_SYSTEM': 'GSI',       # Get system information
    'GET_CHANNEL': 'GCN',      # Get channel name
}

# Expected response format
# GLG,<frequency>
# Example: GLG,154.4300
```

---

### FR-200: Direction Finding System

The direction finding system leverages the KrakenSDR 5-channel coherent receiver to determine bearing to RF emitters.

**FR-201**: System shall accept frequency input from scanner control system via REST API

**FR-202**: System shall tune KrakenSDR to specified frequency within 500ms

**FR-203**: System shall display bearing with minimum 5-degree accuracy

**FR-204**: System shall display confidence level for bearing estimate

**FR-205**: System shall integrate GPS for georeferenced bearing lines

**FR-206**: System shall log all DF measurements with timestamp, position, frequency, and bearing

**FR-207**: System shall support bearing overlay on map display

#### Direction Finding Data Structure

```python
@dataclass
class DFMeasurement:
    """Direction finding measurement record."""
    timestamp: datetime
    frequency_mhz: float
    bearing_degrees: float  # 0-360, 0=North
    confidence: float       # 0.0-1.0
    latitude: float
    longitude: float
    altitude_m: float
    heading_degrees: float  # Vehicle heading at time of measurement

    def to_dict(self) -> dict:
        """Convert to dictionary for storage/transmission."""
        return {
            'timestamp': self.timestamp.isoformat(),
            'frequency_mhz': self.frequency_mhz,
            'bearing_degrees': self.bearing_degrees,
            'confidence': self.confidence,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'altitude_m': self.altitude_m,
            'heading_degrees': self.heading_degrees,
        }
```

---

### FR-300: RF Monitoring System

The RF monitoring system provides continuous surveillance of multiple frequency bands and protocols.

#### FR-300.1: Kismet Integration

**FR-301**: System shall run Kismet server on Main Controller

**FR-302**: System shall support WiFi monitoring in 2.4GHz and 5GHz bands

**FR-303**: System shall support BLE device detection and tracking

**FR-304**: System shall support remote capture sources from Zero 2W nodes

**FR-305**: System shall maintain device database with first-seen, last-seen timestamps

**FR-306**: System shall export data in Kismet, Wigle, and CSV formats

#### FR-300.2: ADS-B Monitoring

**FR-311**: System shall receive and decode ADS-B signals at 1090 MHz

**FR-312**: System shall display aircraft on map with track history

**FR-313**: System shall show aircraft callsign, altitude, speed, and heading

**FR-314**: System shall calculate distance and bearing to aircraft from current position

**FR-315**: System shall support MLAT for non-ADS-B aircraft (when networked)

#### ADS-B Data Structure

```python
@dataclass
class AircraftPosition:
    """ADS-B aircraft position record."""
    icao24: str             # 24-bit ICAO aircraft address
    callsign: str           # Aircraft callsign (8 chars max)
    latitude: float
    longitude: float
    altitude_ft: int        # Altitude in feet
    ground_speed_kt: int    # Ground speed in knots
    track_degrees: int      # Track/heading 0-359
    vertical_rate_fpm: int  # Vertical rate in feet per minute
    timestamp: datetime
    distance_nm: float      # Distance from receiver in nautical miles
    bearing_degrees: float  # Bearing from receiver 0-360
```

#### FR-300.3: ISM Band Monitoring

**FR-321**: System shall decode ISM band devices via rtl_433

**FR-322**: System shall identify and log TPMS sensors with tire position

**FR-323**: System shall decode weather station transmissions

**FR-324**: System shall detect and log wireless doorbells, sensors, and remotes

**FR-325**: System shall publish decoded data to MQTT broker

---

### FR-400: Sensor Mesh Network

The sensor mesh extends monitoring capability beyond the vehicle through distributed sensor nodes.

**FR-401**: Main Controller shall operate WiFi access point for sensor mesh (SSID: SensorMesh)

**FR-402**: System shall support minimum 20 concurrent sensor connections

**FR-403**: System shall provide DHCP and DNS services to sensor network

**FR-404**: System shall run MQTT broker for sensor data ingestion

**FR-405**: Sensor nodes shall report via MQTT with QoS 1 minimum

**FR-406**: System shall support multiple transport paths (WiFi, HaLow) for redundancy

**FR-407**: Sensor data shall include device ID, timestamp, GPS coordinates (if available), and payload

#### Sensor Message Format

```python
@dataclass
class SensorMessage:
    """Standard sensor message format for MQTT."""
    device_id: str          # Unique sensor identifier (e.g., "esp32-01", "zero2w-03")
    timestamp: datetime
    message_type: str       # "wifi_probe", "ble_adv", "ism_decode", "status"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude_m: Optional[float] = None
    payload: dict = field(default_factory=dict)  # Type-specific data

    def to_mqtt_json(self) -> str:
        """Serialize to JSON for MQTT transmission."""
        data = {
            'device_id': self.device_id,
            'timestamp': self.timestamp.isoformat(),
            'message_type': self.message_type,
            'payload': self.payload,
        }
        if self.latitude is not None:
            data['location'] = {
                'latitude': self.latitude,
                'longitude': self.longitude,
                'altitude_m': self.altitude_m,
            }
        return json.dumps(data)
```

---

### FR-500: HaLow Mesh Network

The HaLow mesh provides long-range, low-bandwidth connectivity for extended operations and WAN failover.

**FR-501**: Vehicle HaLowLink shall operate as mesh node on 915 MHz

**FR-502**: Vehicle HaLowLink shall provide 2.4 GHz guest AP (isolated from sensor mesh)

**FR-503**: System shall maintain mesh routing table for multi-hop paths

**FR-504**: System shall support automatic WAN failover from Starlink to HaLow path

**FR-505**: Failover shall occur within 30 seconds of primary WAN failure

**FR-506**: System shall fail back to Starlink when available (with hysteresis)

**FR-507**: HaLow network shall support minimum 1 Mbps throughput at 500m range

**FR-508**: Mesh shall operate with minimum 3 nodes for redundancy

#### WAN Failover State Machine

```python
class WANState(Enum):
    """WAN failover state machine states."""
    STARLINK_ACTIVE = "starlink_active"
    STARLINK_DEGRADED = "starlink_degraded"
    FAILOVER_IN_PROGRESS = "failover_in_progress"
    HALOW_ACTIVE = "halow_active"
    FAILBACK_WAIT = "failback_wait"
    BOTH_DOWN = "both_down"

@dataclass
class WANStatus:
    """WAN connection status."""
    state: WANState
    primary_up: bool        # Starlink connectivity
    backup_up: bool         # HaLow connectivity
    primary_latency_ms: Optional[float]
    backup_latency_ms: Optional[float]
    active_route: str       # "starlink" or "halow"
    failover_count: int     # Number of failovers since boot
    last_failover: Optional[datetime]
```

---

### FR-600: Data Aggregation and Storage

**FR-601**: System shall store time-series data in InfluxDB

**FR-602**: System shall retain minimum 30 days of operational data locally

**FR-603**: System shall support data export to USB storage

**FR-604**: System shall correlate data across sources (scanner, Kismet, ADS-B, sensors)

**FR-605**: System shall generate unified event timeline

**FR-606**: System shall support real-time data streaming to external systems

---

### FR-700: User Interface

**FR-701**: System shall provide unified web dashboard accessible at main-controller.local

**FR-702**: Dashboard shall be optimized for 7-inch touchscreen (1024x600)

**FR-703**: Dashboard shall support dark mode for night operation

**FR-704**: Dashboard shall display real-time status of all subsystems

**FR-705**: Dashboard shall provide quick-access links to Kismet, tar1090, Kraken UIs

**FR-706**: Dashboard shall display current GPS position and heading

**FR-707**: Dashboard shall show WAN status and current route (Starlink vs HaLow)

---

## Non-Functional Requirements

### NFR-100: Performance Requirements

**NFR-101**: Scanner UI shall update frequency display within 300ms of change

**NFR-102**: Kraken tuning shall complete within 500ms of command

**NFR-103**: DF bearing shall update at minimum 2 Hz

**NFR-104**: Dashboard shall load within 3 seconds on local network

**NFR-105**: MQTT message latency shall be under 100ms on sensor mesh

**NFR-106**: System shall process minimum 1000 sensor messages per second

#### Performance Testing

```python
# Performance test example
@pytest.mark.performance
def test_scanner_update_latency():
    """Scanner UI must update within 300ms of frequency change."""
    scanner = ScannerController(port='/dev/ttyUSB0')
    ui = ScannerUI(scanner)

    start_time = time.time()
    scanner.trigger_frequency_change('154.4300')
    ui_update_time = ui.wait_for_update()
    latency_ms = (ui_update_time - start_time) * 1000

    assert latency_ms < 300, f"UI update took {latency_ms}ms, exceeds 300ms requirement"
```

---

### NFR-200: Reliability Requirements

**NFR-201**: System shall operate continuously for minimum 8 hours without restart

**NFR-202**: System shall recover automatically from transient USB disconnections

**NFR-203**: Services shall restart automatically on failure (systemd watchdog)

**NFR-204**: Data shall be persisted to survive unexpected power loss

**NFR-205**: WAN failover shall be transparent to running applications

#### Systemd Service Configuration

```ini
# Example systemd service with watchdog
[Unit]
Description=Scanner UI Service
After=network.target gpsd.service
Requires=gpsd.service

[Service]
Type=notify
ExecStart=/usr/local/bin/scanner-ui
Restart=always
RestartSec=5
WatchdogSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

---

### NFR-300: Environmental Requirements

**NFR-301**: System shall operate in ambient temperatures from 0°C to 45°C

**NFR-302**: System shall tolerate vehicle vibration per SAE J1455

**NFR-303**: Pelican case shall provide IP67 protection when sealed

**NFR-304**: System shall operate from 12V vehicle power (10.5V - 14.4V range)

**NFR-305**: Total system power consumption shall not exceed 100W

---

### NFR-400: Security Requirements

**NFR-401**: Sensor mesh WiFi shall use WPA2-PSK minimum

**NFR-402**: HaLow mesh shall use WPA3-SAE encryption

**NFR-403**: Guest WiFi shall be isolated from all internal networks

**NFR-404**: Web interfaces shall be accessible only from local networks

**NFR-405**: MQTT broker shall require authentication

**NFR-406**: SSH access shall use key-based authentication only

#### Network Security Rules

```python
# Firewall rules (iptables/nftables)
SECURITY_RULES = {
    'guest_isolation': [
        # Guest WiFi (192.168.2.0/24) cannot access internal nets
        '-A FORWARD -s 192.168.2.0/24 -d 192.168.1.0/24 -j REJECT',
        '-A FORWARD -s 192.168.2.0/24 -d 10.0.0.0/24 -j REJECT',
        '-A FORWARD -s 192.168.2.0/24 -d 172.16.0.0/24 -j REJECT',
        # Guest can only access internet via NAT
        '-A FORWARD -s 192.168.2.0/24 -o eth0 -j ACCEPT',
    ],
    'web_services_local_only': [
        # Block web services from WAN
        '-A INPUT -i eth0 -p tcp --dport 8080 -j REJECT',  # Scanner UI
        '-A INPUT -i eth0 -p tcp --dport 2501 -j REJECT',  # Kismet
        '-A INPUT -i eth0 -p tcp --dport 3000 -j REJECT',  # Grafana
    ],
    'mqtt_auth_required': [
        # MQTT broker on localhost only (enforced by mosquitto.conf)
        'listener 1883 10.0.0.1',
        'allow_anonymous false',
        'password_file /etc/mosquitto/passwd',
    ],
}
```

---

### NFR-500: Maintainability Requirements

**NFR-501**: All software shall be deployable via Ansible playbooks

**NFR-502**: Configuration shall be version-controlled in Git

**NFR-503**: System shall support OTA updates when internet available

**NFR-504**: Logs shall be accessible via journalctl and web interface

**NFR-505**: Hardware shall be accessible for maintenance without disassembly

---

## API Specifications

### Scanner Control API

REST API exposed by scanner-ui service on port 8080:

#### GET /api/status
Returns current scanner state.

**Response:**
```json
{
  "frequency_mhz": 154.4300,
  "system_name": "City Police",
  "channel_name": "Dispatch 1",
  "mode": "scanning",
  "signal_strength": -85,
  "timestamp": "2026-01-23T12:34:56Z"
}
```

#### POST /api/hold
Toggle hold on current frequency.

**Response:**
```json
{
  "status": "holding",
  "frequency_mhz": 154.4300
}
```

#### POST /api/scan
Resume scanning.

**Response:**
```json
{
  "status": "scanning"
}
```

#### POST /api/lockout
Lock out current channel.

**Response:**
```json
{
  "status": "locked_out",
  "channel_id": "12345"
}
```

#### GET /api/history
Recent channel history (last 50 entries).

**Query Parameters:**
- `limit` (optional): Number of entries to return (default: 50, max: 200)
- `since` (optional): ISO 8601 timestamp for entries after this time

**Response:**
```json
{
  "history": [
    {
      "timestamp": "2026-01-23T12:34:56Z",
      "frequency_mhz": 154.4300,
      "system_name": "City Police",
      "channel_name": "Dispatch 1",
      "duration_seconds": 12.5,
      "signal_strength": -85
    }
  ],
  "count": 50
}
```

#### POST /api/kraken/tune
Hand off frequency to KrakenSDR for direction finding.

**Request Body:**
```json
{
  "frequency_mhz": 154.4300,
  "bandwidth_hz": 12500,
  "gain_db": 30
}
```

**Response:**
```json
{
  "status": "tuned",
  "kraken_url": "http://kraken-host.local:8080/",
  "session_id": "df-session-12345"
}
```

---

### KrakenSDR API

REST/WebSocket API provided by KrakenSDR software on port 8080:

#### POST /settings
Configure frequency, gain, DOA parameters.

**Request Body:**
```json
{
  "center_freq": 154430000,
  "sample_rate": 2400000,
  "gain": 30,
  "doa_method": "MUSIC",
  "array_type": "UCA",
  "num_elements": 5,
  "element_spacing_m": 0.5
}
```

**Response:**
```json
{
  "status": "configured",
  "tune_time_ms": 245
}
```

#### GET /doa_data
Current bearing and confidence.

**Response:**
```json
{
  "bearing_degrees": 245.3,
  "confidence": 0.87,
  "timestamp": "2026-01-23T12:34:56Z",
  "frequency_mhz": 154.4300,
  "signal_power_db": -65.2
}
```

#### WebSocket /ws
Real-time DOA stream at 2+ Hz.

**Message Format:**
```json
{
  "type": "doa_update",
  "bearing_degrees": 245.3,
  "confidence": 0.87,
  "timestamp": "2026-01-23T12:34:56.789Z",
  "signal_power_db": -65.2
}
```

---

### Aggregator API

Central data ingestion endpoint on port 5000:

#### POST /ingest
Accept sensor data from any source.

**Request Body:**
```json
{
  "device_id": "esp32-01",
  "timestamp": "2026-01-23T12:34:56Z",
  "message_type": "wifi_probe",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "altitude_m": 15.2
  },
  "payload": {
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "ssid": "HomeNetwork",
    "rssi": -75
  }
}
```

**Response:**
```json
{
  "status": "ingested",
  "message_id": "msg-12345"
}
```

#### GET /devices
Query device database.

**Query Parameters:**
- `device_type` (optional): Filter by device type (wifi, ble, adsb, ism)
- `since` (optional): ISO timestamp for devices seen since
- `limit` (optional): Max results (default: 100)

**Response:**
```json
{
  "devices": [
    {
      "device_id": "wifi-AA:BB:CC:DD:EE:FF",
      "device_type": "wifi",
      "first_seen": "2026-01-23T10:00:00Z",
      "last_seen": "2026-01-23T12:34:56Z",
      "seen_count": 47,
      "locations": [
        {"lat": 37.7749, "lon": -122.4194, "timestamp": "2026-01-23T12:34:56Z"}
      ]
    }
  ],
  "count": 1
}
```

#### GET /timeline
Event timeline with filters.

**Query Parameters:**
- `start_time`: ISO timestamp for start of timeline
- `end_time`: ISO timestamp for end of timeline
- `event_types`: Comma-separated list of event types
- `limit`: Max events (default: 1000)

**Response:**
```json
{
  "timeline": [
    {
      "timestamp": "2026-01-23T12:34:56Z",
      "event_type": "scanner_frequency_change",
      "source": "scanner-ui",
      "details": {
        "frequency_mhz": 154.4300,
        "system_name": "City Police"
      }
    },
    {
      "timestamp": "2026-01-23T12:35:02Z",
      "event_type": "df_measurement",
      "source": "kraken-host",
      "details": {
        "bearing_degrees": 245.3,
        "confidence": 0.87
      }
    }
  ],
  "count": 2
}
```

#### GET /export
Data export in various formats.

**Query Parameters:**
- `format`: Export format (json, csv, kismet, wigle)
- `start_time`: ISO timestamp
- `end_time`: ISO timestamp
- `data_types`: Comma-separated (scanner, df, adsb, sensors)

**Response:**
Content-Type varies by format. Returns downloadable file.

---

## Hardware Specifications

### Power System

All components operate from vehicle 12V power via appropriate DC-DC converters.

| Component | Voltage | Max Current | Converter |
|-----------|---------|-------------|-----------|
| Pi 5 (x2) | 5V | 5A each | 12V→5V 5A (x2) |
| Pi 4 | 5V | 3A | 12V→5V 3A |
| Netgear GS308 | 12V | 0.5A | Direct 12V |
| HaLowLink | 5V | 2A | 12V→5V 3A |
| 7" Display | 5V | 1A | Shared with Pi 5 |
| KrakenSDR | 5V | 2.5A | USB from Pi 5 |
| Cooling Fans | 5V/12V | 0.5A | Various |

**Total Power Budget:**
- Typical: 75-85W
- Peak: 100W

---

### Antenna Requirements

| Purpose | Frequency | Type | Mounting |
|---------|-----------|------|----------|
| KrakenSDR DF | Various | 5x matched dipole array | Roof magnetic mount |
| ADS-B | 1090 MHz | Vertical collinear | Roof magnetic mount |
| HaLow | 915 MHz | Omni or directional | Roof or case mount |
| WiFi Sensor | 2.4/5 GHz | Dual-band omni | Internal or case mount |
| GPS | 1575 MHz | Active patch | Roof magnetic mount |

---

## Testing Requirements

### Unit Testing

- All Python modules shall have minimum 80% code coverage
- Serial communication shall be testable with mock scanner
- MQTT handling shall be tested with in-memory broker
- API endpoints shall have integration tests

#### Test Structure

```python
# tests/unit/test_scanner_controller.py
import pytest
from unittest.mock import Mock, patch
from scanner_ui.controller import ScannerController

@pytest.fixture
def mock_serial():
    """Fixture providing a mock serial connection."""
    with patch('serial.Serial') as mock:
        yield mock

class TestScannerController:
    """Test suite for scanner controller."""

    def test_parse_frequency_response(self):
        """Test GLG response parsing."""
        response = "GLG,154.4300\r"
        freq = ScannerController.parse_frequency(response)
        assert freq == 154.4300
        assert isinstance(freq, float)

    def test_hold_command(self, mock_serial):
        """Test hold command sends correct bytes."""
        controller = ScannerController(port='/dev/ttyUSB0')
        controller.hold()
        mock_serial.return_value.write.assert_called_with(b'KEY,H\r')

    def test_reconnect_on_usb_disconnect(self, mock_serial):
        """Test automatic reconnection after USB disconnect."""
        controller = ScannerController(port='/dev/ttyUSB0')
        mock_serial.return_value.read.side_effect = [
            serial.SerialException("Device disconnected"),
            b"GLG,154.4300\r"
        ]
        # Should reconnect automatically
        freq = controller.get_frequency()
        assert freq == 154.4300
        assert mock_serial.return_value.close.called
        assert mock_serial.call_count == 2  # Initial + reconnect
```

---

### System Testing

Required system-level integration tests:

1. **End-to-end scanner control workflow**
   - Boot to operational state
   - Scanner serial communication
   - UI responsiveness
   - Data logging

2. **Scanner to Kraken handoff timing verification**
   - Measure latency from button press to Kraken tuned
   - Verify < 500ms requirement
   - Test under load

3. **Sensor data flow from edge to dashboard**
   - ESP32 → MQTT → InfluxDB → Grafana
   - Verify data integrity
   - Measure end-to-end latency

4. **WAN failover and recovery scenarios**
   - Simulate Starlink failure
   - Verify failover to HaLow
   - Verify failback when Starlink returns
   - Test hysteresis (no flapping)

5. **Power cycle recovery verification**
   - Hard power cut during operation
   - Verify clean boot and data integrity
   - Check filesystem corruption

---

### Environmental Testing

Required environmental validation:

1. **Thermal testing at 0°C and 45°C ambient**
   - Measure CPU temperatures
   - Verify no thermal throttling
   - Check fan operation

2. **Vibration testing during vehicle operation**
   - 30-minute driving test
   - Monitor for USB disconnects
   - Check mounting stability

3. **Extended operation testing (8+ hours continuous)**
   - Memory leak detection
   - Disk space growth
   - Service stability

4. **Power variation testing (10.5V - 14.4V)**
   - Simulate engine start (voltage drop)
   - Verify brownout protection
   - Test at voltage extremes

---

## Service Dependencies

Service startup order and dependencies are managed by systemd:

```
Boot
├── gpsd (GPS daemon)
│   ├── scanner-ui (depends on GPS time)
│   └── aggregator (depends on GPS data)
├── mosquitto (MQTT broker)
│   ├── aggregator (depends on MQTT)
│   └── sensor services (all depend on MQTT)
├── influxdb (Database)
│   ├── aggregator (depends on InfluxDB)
│   └── grafana (depends on InfluxDB)
└── nginx (Web server - starts last)
    └── All backend services must be running
```

---

## MQTT Topic Schema

### Topic Naming Convention

`<domain>/<subsystem>/<message_type>[/<detail>]`

### Complete Topic List

```
sensors/
├── wifi/
│   ├── probes          # WiFi probe requests from ESP32
│   └── devices         # Detected WiFi devices from Kismet
├── ble/
│   ├── advertisements  # Raw BLE advertisements from nRF52
│   └── devices         # Processed BLE device records
└── ism/
    ├── rtl433          # Generic ISM band decodes
    └── tpms            # Tire pressure monitor sensors

scanner/
├── status              # Current scanner state
└── history             # Channel activity log

kraken/
├── bearing             # Current DF bearing and confidence
└── target              # Active DF target information

adsb/
└── aircraft            # Aircraft position updates

system/
├── gps                 # Vehicle position and heading
├── status              # Health and status of all subsystems
└── alerts              # System alerts and notifications
```

### Message QoS Levels

- **QoS 0** (at most once): `system/status`, `scanner/status` - high frequency, loss acceptable
- **QoS 1** (at least once): All sensor data, DF measurements, alerts - delivery important
- **QoS 2** (exactly once): Critical alerts, configuration changes - no duplicates

---

## Configuration File Locations

All configuration files follow standard Linux conventions:

```
/etc/
├── mosquitto/
│   ├── mosquitto.conf
│   └── passwd
├── influxdb/
│   └── influxdb.conf
├── grafana/
│   └── grafana.ini
├── kismet/
│   └── kismet_site.conf
├── hostapd/
│   └── hostapd.conf
├── systemd/system/
│   ├── scanner-ui.service
│   ├── aggregator.service
│   └── ...
└── nginx/
    └── sites-available/
        └── sigint-dashboard

/opt/sigint/
├── scanner-ui/
│   ├── app.py
│   └── config.py
├── aggregator/
│   └── ...
└── venv/

/var/lib/
├── influxdb/
├── grafana/
└── kismet/

/var/log/
└── sigint/
    ├── scanner-ui.log
    ├── aggregator.log
    └── ...
```

---

## Error Handling Standards

All services must implement consistent error handling:

```python
import logging
from enum import Enum
from typing import Optional

class ErrorSeverity(Enum):
    """Error severity levels."""
    INFO = "info"           # Informational, no action needed
    WARNING = "warning"     # Potential issue, degraded operation
    ERROR = "error"         # Operation failed, retry possible
    CRITICAL = "critical"   # System failure, immediate attention required

class SIGINTError(Exception):
    """Base exception for all SIGINT platform errors."""

    def __init__(
        self,
        message: str,
        severity: ErrorSeverity = ErrorSeverity.ERROR,
        component: str = "unknown",
        recoverable: bool = True,
        context: Optional[dict] = None
    ):
        self.message = message
        self.severity = severity
        self.component = component
        self.recoverable = recoverable
        self.context = context or {}
        super().__init__(self.message)

    def to_alert(self) -> dict:
        """Convert to system alert for MQTT."""
        return {
            'severity': self.severity.value,
            'component': self.component,
            'message': self.message,
            'recoverable': self.recoverable,
            'context': self.context,
            'timestamp': datetime.utcnow().isoformat()
        }

# Usage example
try:
    scanner.get_frequency()
except serial.SerialException as e:
    error = SIGINTError(
        message=f"Scanner serial communication failed: {e}",
        severity=ErrorSeverity.ERROR,
        component="scanner-ui",
        recoverable=True,
        context={'port': '/dev/ttyUSB0', 'baud': 9600}
    )
    logging.error(error.message, extra=error.context)
    mqtt_client.publish('system/alerts', error.to_alert())
    # Attempt recovery
    scanner.reconnect()
```

---

## Glossary

- **ADS-B**: Automatic Dependent Surveillance-Broadcast - aircraft transponder system
- **BLE**: Bluetooth Low Energy
- **CAT**: Computer Aided Transceiver control
- **DF**: Direction Finding
- **DOA**: Direction of Arrival
- **HaLow**: IEEE 802.11ah - sub-GHz WiFi standard
- **ISM**: Industrial, Scientific, Medical - unlicensed radio bands
- **MQTT**: Message Queuing Telemetry Transport
- **SDR**: Software Defined Radio
- **SIGINT**: Signals Intelligence
- **TPMS**: Tire Pressure Monitoring System
- **QoS**: Quality of Service (MQTT message delivery guarantee)
- **MUSIC**: MUltiple SIgnal Classification (DOA algorithm)
- **UCA**: Uniform Circular Array (antenna arrangement)

---

## References

- KrakenSDR Documentation: https://github.com/krakenrf/krakensdr_docs
- Kismet Documentation: https://www.kismetwireless.net/docs/
- Uniden BCD996P2 Serial Protocol: Owner's Manual Appendix
- Morse Micro HaLowLink: https://www.morsemicro.com/
- OpenWRT Documentation: https://openwrt.org/docs/
- readsb ADS-B Decoder: https://github.com/wiedehopf/readsb
- rtl_433 ISM Decoder: https://github.com/merbanan/rtl_433
- InfluxDB Documentation: https://docs.influxdata.com/
- Grafana Documentation: https://grafana.com/docs/
- Flask Framework: https://flask.palletsprojects.com/
- pytest Documentation: https://docs.pytest.org/

---

*This technical reference is the authoritative source for all implementation decisions. When in doubt, refer to this document and the associated TRD/PRD in the ProjectDocuments folder.*
