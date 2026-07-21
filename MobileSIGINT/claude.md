# Mobile SIGINT Platform - Developer Guide

**Version 1.0 | January 2026**

## Project Overview

The Mobile SIGINT Platform is a comprehensive vehicle-mounted RF intelligence collection system that integrates multiple sensing technologies, direction finding capabilities, and resilient mesh networking to create a professional-grade signals intelligence platform.

### Key Capabilities

- **Multi-band RF Monitoring**: BLE, WiFi (2.4/5GHz), ADS-B, TPMS, ISM band devices, trunked radio systems
- **Real-time Direction Finding**: KrakenSDR 5-channel coherent receiver with ±10° accuracy
- **Scanner Integration**: Uniden BCD996P2 with touch-optimized driving interface and one-button DF handoff
- **Distributed Sensor Mesh**: WiFi-based mesh for wide-area coverage with ESP32 and Pi Zero 2W nodes
- **Dual-WAN Connectivity**: Starlink (primary) + HaLow 915MHz mesh (backup/failover)
- **GridDown-Ready Operation**: All services functional without internet connectivity
- **Touch-Optimized Interface**: 7" touchscreen interface designed for safe operation while driving

---

## Repository Layout & Subproject Status

*Last updated: 2026-07-21. All paths are relative to this `MobileSIGINT/` directory, which is the umbrella project. Legend: 🟢 working · 🟡 in progress · ⚪ dependency/dormant.*

The platform is assembled from several independently-developed subprojects, each in its own folder:

| Folder | Platform Role | Stack | State |
|--------|---------------|-------|-------|
| `OnTheGo Scanner/` | Operator app — RF spectrum + telemetry on a map (RTL-SDR waterfall, ADS-B aircraft, drone Remote ID, GPS); offline-first | TypeScript, Electron, React/Vite, Fastify, SQLite | 🟢 **Working MVP**, being hardened to spec on branch `feature/trd-prd-compliance`. Done 2026-07-21: BLE drone RID made F3411-22a wire-accurate (field test pending), RF spectrum/waterfall polish. WIP: enhanced settings panel |
| `Sensor Node/` | Edge sensor — passive WiFi/BLE presence detection with privacy-preserving fingerprints; reports over HaLow mesh | C, ESP-IDF (ESP32-S3), NimBLE, mbedTLS | 🟡 **Builds & runs**, all modules implemented. Source tracked in the umbrella repo since 2026-07-21; GPS + timestamp are hardcoded stubs; dormant since May 2025 |
| `GridDown/` | Offline services + long-range mesh — intranet server (bulletin, offline wiki, files) and HaLow mesh gateway for grid-down operation | Python/FastAPI + SQLite + Docker/Caddy; OpenWRT + BATMAN-adv | 🟡 **Late beta** (~80–95%). Own git repo; CLI mesh deploy works, no LuCI UI; last commit Dec 2025 |
| `OSINT Extractor/` | Intelligence feed — OSINT extraction (Reddit→local LLM→geocode) plus a "bug-out" readiness dashboard (weather/fuel/advisory signals → GREEN/YELLOW/RED) | Python, llama.cpp, FastAPI, APScheduler, SQLite | 🟡 **MVP complete; v2 largely complete** and test-backed. Nested own git repo; note: v2's CLI entry point has an uncommitted deletion |
| `mm-iot-esp32/` | Shared radio SDK — Morse Micro Wi-Fi HaLow (802.11ah) SDK; the RF foundation used by Sensor Node and GridDown's mesh | C/C++, ESP-IDF, vendor driver blobs | ⚪ **Functional vendor port** (v2.6.4), locally customized. Dependency, not an app; dormant since Jan 2025 |

**Supporting docs & assets (this folder):**
- `claude-technical-reference.md` — full FR/NFR requirements & API specifications
- `ProjectDocuments/` — TRD/PRD, implementation plan, and phase-gate testing criteria
- `Agents and Skills/` — Claude skill packages for the GridDown mesh work

> **Note on stack drift:** The subprojects above are the *actual* implemented code and differ from the originally-specified stack in this guide (e.g. the operator UI is a TypeScript/Electron app — "OnTheGo Scanner" — not the Flask `scanner-ui` described under Software Stack). Treat the phased plan and Software Stack sections as original design intent; treat this table as ground truth for what exists today.

> **Git note:** Since the 2026-07-21 restructure, the `.git` at the parent of this folder is the single umbrella repo (it carries the OnTheGo Scanner history through the move — use `git log --follow`). `GridDown/`, `mm-iot-esp32/`, and `OSINT Extractor/` keep their own nested repos and are excluded from the umbrella via `.gitignore`. The retired near-empty `MobileSIGINT/.git` is archived local-only in `.git-archives/`.

---

## System Architecture

### Hardware Components

| Device | Role | Specifications |
|--------|------|----------------|
| **Raspberry Pi 5 #1** | KrakenSDR Host | 8GB RAM, NVMe SSD, dedicated DSP workload |
| **Raspberry Pi 5 #2** | Main Controller | 8GB RAM, 256GB SSD, Kismet, aggregator, dashboard, WiFi AP |
| **Raspberry Pi 4** | ADS-B Station | 4GB RAM, readsb, tar1090, optional AIS |
| **HaLowLink (Vehicle)** | Mesh Gateway | OpenWRT, 2.4GHz AP, 915MHz HaLow mesh |
| **HaLowLink (Home)** | Backup WAN | Internet gateway for mesh failover |
| **Netgear GS308** | Network Switch | 8-port gigabit, 12V native input |
| **BCD996P2** | Scanner | Trunked radio monitoring, serial CAT control |
| **KrakenSDR** | Direction Finding | 5-channel coherent RTL-SDR array |
| **Zero 2W Nodes** | Remote Sensors | Distributed WiFi/BLE monitoring (6x) |
| **ESP32/nRF52** | Edge Sensors | BLE beacons, WiFi probes, ISM monitoring |

### Network Architecture

The platform uses four distinct network segments:

| Subnet | CIDR | Purpose |
|--------|------|---------|
| **Vehicle Main LAN** | 192.168.1.0/24 | Core infrastructure: Pis, switch, Starlink gateway |
| **Guest WiFi** | 192.168.2.0/24 | Isolated network for phones/tablets via HaLowLink AP |
| **Sensor Mesh** | 10.0.0.0/24 | Private network for Zero 2W and ESP32 sensors |
| **HaLow Backbone** | 172.16.0.0/24 | 915MHz mesh linking vehicle to remote nodes and home base |

### IP Address Allocation

| Device | IP Address | Network |
|--------|-----------|---------|
| Starlink Router | 192.168.1.1 | Vehicle LAN (Gateway) |
| Pi 5 Main Controller | 192.168.1.50, 10.0.0.1 | Vehicle LAN + Sensor Mesh |
| Pi 5 Kraken Host | 192.168.1.51 | Vehicle LAN |
| Pi 4 ADS-B Station | 192.168.1.52 | Vehicle LAN |
| HaLowLink (Vehicle) | 192.168.1.53, 192.168.2.1, 172.16.0.1 | All networks |
| HaLowLink (Home) | 172.16.0.254 | HaLow Backbone |
| Zero 2W Nodes | 10.0.0.20-29 | Sensor Mesh |
| ESP32 Nodes | 10.0.0.30-39 | Sensor Mesh |

### Software Stack

#### Operating Systems
- **Pi 5 (Main/Kraken)**: Raspberry Pi OS Lite (64-bit) Bookworm-based, headless
- **Pi 4 (ADS-B)**: DietPi or Pi OS Lite, lightweight for single purpose
- **HaLowLink**: OpenWRT 23.05+ with Morse Micro driver support
- **Zero 2W**: Raspberry Pi OS Lite (32-bit) minimal install

#### Core Services by Host

**Main Controller (Pi 5 #2)**
- `scanner-ui`: Custom Flask application for BCD996P2 control
- `kismet`: WiFi/BLE/RF monitoring and device tracking
- `gpsd`: GPS daemon providing time and position
- `hostapd`: WiFi access point for sensor mesh
- `dnsmasq`: DHCP and DNS for sensor network
- `mosquitto`: MQTT broker for sensor data
- `influxdb`: Time-series database
- `grafana`: Dashboard and visualization
- `nginx`: Reverse proxy for all web services
- `aggregator`: Custom service correlating all data sources

**Kraken Host (Pi 5 #1)**
- `krakensdr_doa`: Direction of arrival DSP processing
- `krakensdr_pr`: Passive radar (optional)
- `nginx`: Proxy for remote access

**ADS-B Station (Pi 4)**
- `readsb`: ADS-B decoder (replaces dump1090)
- `tar1090`: Web-based aircraft map
- `graphs1090`: Statistics and graphs
- `mlat-client`: Multilateration client

#### Development Stack
- **Python 3.11+**: Primary application language
- **Flask**: Web framework for custom services
- **pyserial**: Scanner serial communication
- **paho-mqtt**: MQTT client library
- **influxdb-client**: Database access
- **pynmea2**: GPS NMEA parsing
- **requests**: HTTP client for inter-service communication

---

## Development Guidelines

### Test-Driven Development (TDD) - REQUIRED

**All code for this project MUST be developed using Test-Driven Development methodology.**

#### TDD Workflow

1. **Write the test first** - Before writing any production code, write a failing test that defines the desired behavior
2. **Run the test** - Verify the test fails (Red phase)
3. **Write minimal code** - Write just enough code to make the test pass
4. **Run the test again** - Verify the test passes (Green phase)
5. **Refactor** - Improve the code while keeping tests passing
6. **Repeat** - Continue this cycle for each new feature or bug fix

#### Testing Requirements

- **Minimum 80% code coverage** for all Python modules
- **Unit tests** for all functions and methods
- **Integration tests** for API endpoints and service interactions
- **Mock objects** for external dependencies (scanner serial, GPS, MQTT broker)
- **Property-based tests** for critical algorithms (DF calculations, data parsing)

#### Testing Framework

```python
# Use pytest as the primary testing framework
import pytest
from unittest.mock import Mock, patch

# Example TDD test structure
def test_scanner_frequency_parsing():
    """Test that scanner frequency is correctly parsed from serial response."""
    # Arrange
    mock_response = "GLG,154.4300"

    # Act
    frequency = parse_scanner_frequency(mock_response)

    # Assert
    assert frequency == 154.4300
    assert isinstance(frequency, float)

@pytest.fixture
def mock_scanner():
    """Fixture providing a mock scanner connection."""
    with patch('serial.Serial') as mock_serial:
        yield mock_serial

def test_scanner_hold_command(mock_scanner):
    """Test that hold command is sent correctly to scanner."""
    # Arrange
    scanner = ScannerController(port='/dev/ttyUSB0')

    # Act
    result = scanner.hold()

    # Assert
    mock_scanner.return_value.write.assert_called_with(b'KEY,H\r')
    assert result is True
```

#### Test Organization

```
project/
├── src/
│   ├── scanner_ui/
│   │   ├── __init__.py
│   │   ├── controller.py
│   │   └── api.py
│   └── aggregator/
│       ├── __init__.py
│       └── data_pipeline.py
├── tests/
│   ├── unit/
│   │   ├── test_scanner_controller.py
│   │   └── test_aggregator.py
│   ├── integration/
│   │   ├── test_scanner_api.py
│   │   └── test_mqtt_pipeline.py
│   └── fixtures/
│       └── mock_data.py
└── pytest.ini
```

#### Running Tests

```bash
# Run all tests with coverage
pytest --cov=src --cov-report=html --cov-report=term

# Run specific test file
pytest tests/unit/test_scanner_controller.py -v

# Run tests matching a pattern
pytest -k "scanner" -v

# Run with live logging for debugging
pytest --log-cli-level=DEBUG
```

### Code Quality Standards

- **Type hints** required for all function signatures
- **Docstrings** required for all public functions, classes, and modules
- **Linting**: Use `ruff` or `pylint` to enforce style
- **Formatting**: Use `black` for consistent code formatting
- **Git commits**: Follow conventional commits format

### Security Requirements

- **No hardcoded credentials** - Use environment variables or config files
- **Input validation** - Validate all external inputs (serial data, API requests)
- **SQL injection prevention** - Use parameterized queries
- **XSS prevention** - Sanitize all HTML output
- **Authentication** - SSH key-based only, no passwords
- **Network isolation** - Enforce firewall rules between network segments

---

## Phased Implementation Plan

### Budget Summary

| Phase | Focus Area | Duration | Budget |
|-------|-----------|----------|--------|
| **Phase 1** | Core Vehicle System | 2-3 weeks | $313 |
| **Phase 2** | KrakenSDR Integration | 1-2 weeks | $520 |
| **Phase 3** | ADS-B Station | 1 week | $125 |
| **Phase 4** | Sensor Mesh Network | 2-3 weeks | $95 |
| **Phase 5** | HaLow Mesh + Advanced | 2-4 weeks | $115 |
| **TOTAL** | | **8-16 weeks** | **$1,168** |

### Phase 1: Core Vehicle System

**Objective**: Establish Main Controller as the central hub with scanner integration, Kismet monitoring, GPS, and vehicle deployment.

#### Hardware Required
- Raspberry Pi 5 8GB (on hand)
- 256GB NVMe SSD + HAT ($45)
- 7" Touch Display ($70)
- USB GPS u-blox VK-162 ($18)
- Netgear GS308 Switch ($30)
- Pelican Case 1500 ($100)
- 12V→5V 5A Converter ($15)
- Cables, misc ($30)

#### Implementation Steps

**Week 1: Base System Setup**
- [ ] Flash Raspberry Pi OS Lite (64-bit) to NVMe SSD
- [ ] Configure hostname: main-controller, static IP: 192.168.1.50
- [ ] Enable SSH with key-based auth
- [ ] Install and configure gpsd with USB GPS
- [ ] Install Kismet and configure for WiFi monitoring
- [ ] Write tests for GPS data parsing (TDD)
- [ ] Write tests for Kismet API integration (TDD)

**Week 2: Scanner Integration**
- [ ] Connect BCD996P2 via USB, identify serial port
- [ ] Write tests for scanner serial protocol (TDD)
- [ ] Create scanner-ui Flask application (TDD)
- [ ] Implement hold/scan/lockout controls (TDD)
- [ ] Configure auto-start and kiosk mode
- [ ] Write integration tests for scanner UI

**Week 3: Vehicle Deployment**
- [ ] Design and cut Pelican case foam inserts
- [ ] Wire 12V power distribution
- [ ] Install and test in vehicle
- [ ] Verify thermal performance
- [ ] Run full integration tests
- [ ] Execute Phase 1 gate testing criteria

#### Validation Criteria
- ✓ Scanner UI displays frequency within 500ms of change
- ✓ System survives 2-hour driving test without issues
- ✓ System boots to operational state within 90 seconds
- ✓ GPS achieves fix within 60 seconds outdoors
- ✓ Kismet detects WiFi devices
- ✓ All services auto-restart on failure
- ✓ 80%+ code coverage for all modules

---

### Phase 2: KrakenSDR Integration

**Objective**: Add real-time direction finding capability with scanner-to-Kraken handoff.

#### Hardware Required
- Raspberry Pi 5 8GB (on hand)
- KrakenSDR 5-channel ($350)
- 5x Matched dipole antennas ($100)
- Magnetic antenna mount ($50)

#### Implementation Steps
- [ ] Flash KrakenSDR image to Pi 5
- [ ] Configure hostname: kraken-host, IP: 192.168.1.51
- [ ] Connect KrakenSDR, run calibration
- [ ] Write tests for Kraken API integration (TDD)
- [ ] Add Kraken tuning API to scanner-ui (TDD)
- [ ] Implement one-button DF handoff (TDD)
- [ ] Add bearing display to driving UI
- [ ] Execute Phase 2 gate testing criteria

#### Validation Criteria
- ✓ Kraken tunes to frequency within 500ms
- ✓ Bearing accuracy within 10° on test signal
- ✓ One-button DF handoff functional
- ✓ Bearing displayed on driving UI
- ✓ System stable during 1-hour DF session

---

### Phase 3: ADS-B Station

**Objective**: Set up dedicated ADS-B receiver with tar1090 integration.

#### Hardware Required
- Raspberry Pi 4 4GB (on hand)
- RTL-SDR Blog V4 ($40)
- 1090 MHz filter ($20)
- 1090 MHz LNA ($25)
- ADS-B antenna ($30)

#### Implementation Steps
- [ ] Flash DietPi to SD card
- [ ] Configure hostname: adsb-station, IP: 192.168.1.52
- [ ] Install readsb and tar1090
- [ ] Optimize gain settings
- [ ] Add tar1090 link to dashboard
- [ ] Write tests for ADS-B data parsing (TDD)
- [ ] Execute Phase 3 gate testing criteria

#### Validation Criteria
- ✓ ADS-B station accessible via dashboard
- ✓ Aircraft displayed on tar1090 map
- ✓ Distance/bearing to aircraft calculated
- ✓ System operates standalone after power cycle

---

### Phase 4: Sensor Mesh Network

**Objective**: Deploy distributed sensor mesh with MQTT, InfluxDB, and Grafana.

#### Hardware Required
- ESP32-WROOM DevKit x2 (on hand)
- Pi Zero 2W x2 (on hand)
- USB WiFi adapters x2 ($20)
- Battery packs x3 ($45)
- Enclosures x3 ($30)

#### Implementation Steps
- [ ] Configure hostapd and dnsmasq on Main Controller
- [ ] Install Mosquitto, InfluxDB, Grafana
- [ ] Write tests for MQTT message handling (TDD)
- [ ] Write tests for InfluxDB data pipeline (TDD)
- [ ] Flash ESP32 with WiFi probe scanner
- [ ] Configure Zero 2W with Kismet remote capture
- [ ] Install and configure rtl_433
- [ ] Build Grafana dashboards
- [ ] Execute Phase 4 gate testing criteria

#### Validation Criteria
- ✓ WiFi AP supports 20 concurrent sensors
- ✓ MQTT latency < 100ms
- ✓ Sensor data visible in Grafana
- ✓ ESP32 nodes report WiFi probes
- ✓ Zero 2W remote capture functional
- ✓ rtl_433 decoding TPMS/ISM devices

---

### Phase 5: HaLow Mesh + Advanced Integration

**Objective**: Deploy HaLow mesh for extended range, implement WAN failover, complete unified dashboard, and test GridDown operation.

#### Hardware Required
- Morse Micro HaLowLink x3 (on hand)
- 915 MHz antennas x3 ($45)
- Starlink (variable)
- Enclosure for home base ($40)

#### Implementation Steps
- [ ] Flash OpenWRT to HaLowLink devices
- [ ] Configure vehicle HaLowLink (eth0, wlan0, halow0)
- [ ] Set up guest network isolation
- [ ] Configure home base HaLowLink
- [ ] Test mesh connectivity and range
- [ ] Write tests for WAN failover logic (TDD)
- [ ] Implement WAN failover script
- [ ] Build unified web dashboard
- [ ] Write integration tests for full system
- [ ] Test GridDown operation
- [ ] Execute Phase 5 gate testing criteria

#### Validation Criteria
- ✓ HaLow mesh operational at 500m LOS
- ✓ WAN failover < 30 seconds
- ✓ Guest AP isolated from internal networks
- ✓ GridDown operation functional (all local services work without internet)
- ✓ Unified dashboard complete and accessible
- ✓ 8-hour continuous operation test passed
- ✓ All security requirements met

---

## Service URLs Quick Reference

- **Main Dashboard**: http://main-controller.local/
- **Scanner UI**: http://main-controller.local:8080/
- **Kismet**: http://main-controller.local:2501/
- **Grafana**: http://main-controller.local:3000/
- **Kraken DOA**: http://kraken-host.local:8080/
- **tar1090**: http://adsb-station.local/tar1090/

---

## Data Model

### MQTT Topic Hierarchy

All sensor data flows through MQTT using a hierarchical topic structure:

- `sensors/wifi/probes` - WiFi probe requests from ESP32 nodes
- `sensors/wifi/devices` - Detected WiFi devices from Kismet
- `sensors/ble/advertisements` - BLE advertisements from nRF52 nodes
- `sensors/ble/devices` - Processed BLE device records
- `sensors/ism/rtl433` - Decoded ISM band devices
- `sensors/ism/tpms` - Tire pressure monitor data
- `scanner/status` - Current scanner state (frequency, system, channel)
- `scanner/history` - Channel activity log
- `kraken/bearing` - Current DF bearing and confidence
- `kraken/target` - Active DF target information
- `adsb/aircraft` - Aircraft position updates
- `system/gps` - Vehicle position and heading
- `system/status` - Health and status of all subsystems
- `system/alerts` - System alerts and notifications

### Data Retention Policy

| Data Type | Retention | Storage |
|-----------|-----------|---------|
| Raw sensor messages | 7 days | InfluxDB |
| Aggregated device records | 30 days | InfluxDB |
| DF measurements | 90 days | InfluxDB + SQLite |
| Scanner history | 30 days | SQLite |
| Kismet database | Per session | SQLite (kismetdb) |
| System logs | 14 days | journald |

---

## Key Milestones

| Week | Milestone | Deliverable |
|------|-----------|-------------|
| 3 | Core system operational in vehicle | Scanner UI + Kismet |
| 5 | Direction finding capability online | Scanner → Kraken DF |
| 6 | Aircraft tracking operational | tar1090 dashboard |
| 9 | Distributed sensor mesh functional | MQTT + Grafana |
| 12 | Full system integration complete | Unified dashboard |

---

## Long Lead Time Items - Order Early

- KrakenSDR from CrowdSupply (2-4 weeks lead time)
- 1090 MHz filter and LNA
- Quality 12V→5V converters
- Pelican case

---

## Additional Documentation

- **Technical Reference**: See `claude-technical-reference.md` for complete functional requirements, API specifications, and detailed technical constraints
- **Testing Criteria**: See `ProjectDocuments/mobile-sigint-testing-criteria.md` for phase-gate testing procedures
- **TRD/PRD**: See `ProjectDocuments/SIGINT TRD-PRD.pdf` for complete technical requirements
- **Implementation Plan**: See `ProjectDocuments/SIGINT Implementation Plan.pdf` for detailed phasing
