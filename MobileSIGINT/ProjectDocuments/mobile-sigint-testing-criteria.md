# Mobile SIGINT Platform
## Phase-Gate Testing Criteria

**Version 1.0 | January 2026**

---

## Document Purpose

This document defines comprehensive testing requirements that must be completed and passed before transitioning between implementation phases. Each phase gate includes unit tests, integration tests, acceptance criteria, rollback procedures, and sign-off requirements.

**Testing Philosophy:** No phase transition occurs until all gate criteria are met. Failed gates trigger rollback procedures and root cause analysis before retry.

---

## Phase Gate Summary

| Phase | Gate Name | Critical Path Items | Estimated Test Duration |
|-------|-----------|---------------------|------------------------|
| 1 | Core Vehicle Readiness | Boot sequence, GPS lock, Scanner comms, Thermal | 3-4 days |
| 2 | Direction Finding Operational | Kraken calibration, Frequency handoff, Bearing accuracy | 2-3 days |
| 3 | ADS-B Integration Complete | Decoder performance, Dashboard integration | 1-2 days |
| 4 | Sensor Mesh Functional | AP stability, MQTT throughput, Node connectivity | 3-4 days |
| 5 | Full System Integration | HaLow mesh, WAN failover, GridDown operation | 4-5 days |

---

## Phase 1: Core Vehicle System

### Gate 1: Core Vehicle Readiness

#### 1.1 Unit Tests

##### UT-1.1.1: Boot Sequence Validation
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-1.1.1a | Cold boot to login prompt | < 45 seconds | Stopwatch from power-on |
| UT-1.1.1b | Cold boot to operational state | < 90 seconds | Stopwatch to scanner-ui responsive |
| UT-1.1.1c | Service startup order | All services start without dependency failures | `systemctl list-units --failed` returns empty |
| UT-1.1.1d | NVMe detection | SSD detected and mounted on every boot | 10 consecutive boot tests |

##### UT-1.1.2: GPS Subsystem
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-1.1.2a | GPS daemon startup | gpsd running within 30s of boot | `systemctl status gpsd` |
| UT-1.1.2b | Cold start time to first fix | < 60 seconds with clear sky | `gpsmon` observation |
| UT-1.1.2c | Position accuracy | CEP < 5 meters after 5 minutes | Compare to known survey point |
| UT-1.1.2d | Time sync | System clock within 100ms of GPS time | `chronyc tracking` |
| UT-1.1.2e | GPS data format | Valid NMEA sentences on /dev/ttyUSB* | `gpspipe -r` output validation |

##### UT-1.1.3: Scanner Serial Communication
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-1.1.3a | Serial port detection | BCD996P2 detected as /dev/ttyUSB* | `dmesg | grep tty` |
| UT-1.1.3b | Baud rate negotiation | 9600 baud connection established | pyserial connection test |
| UT-1.1.3c | Command response | Scanner responds to STS command | Send STS, verify response < 100ms |
| UT-1.1.3d | Frequency query | GLG command returns valid frequency | Parse GLG response |
| UT-1.1.3e | Hold command | KEY,H command holds current channel | Verify scan stops |
| UT-1.1.3f | Scan resume | KEY,S command resumes scanning | Verify scan resumes |

##### UT-1.1.4: Kismet Subsystem
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-1.1.4a | Kismet server startup | Server responsive on port 2501 | HTTP GET to /system/status.json |
| UT-1.1.4b | WiFi source initialization | At least one WiFi source active | Check /datasource/all_sources.json |
| UT-1.1.4c | Device detection | Detects test AP within 30 seconds | Monitor /devices/last-time endpoint |
| UT-1.1.4d | Database write | Kismet .kismet file created and growing | File size check over 5 minutes |
| UT-1.1.4e | Web UI accessibility | Kismet web UI loads in browser | Manual verification |

#### 1.2 Integration Tests

##### IT-1.2.1: Scanner-UI Integration
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-1.2.1a | Frequency display latency | UI updates within 500ms of frequency change | Timestamp comparison |
| IT-1.2.1b | Touch control responsiveness | Hold/Scan/Lockout respond < 200ms | Stopwatch + UI feedback |
| IT-1.2.1c | History logging | Channel changes logged with timestamp | Database query verification |
| IT-1.2.1d | Kiosk mode stability | UI remains in foreground for 2 hours | Automated monitoring |
| IT-1.2.1e | USB reconnection | UI recovers from USB disconnect/reconnect | Physical disconnect test |

##### IT-1.2.2: System Integration
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-1.2.2a | GPS-to-Kismet | Kismet receives GPS coordinates | Verify geolocated devices in Kismet |
| IT-1.2.2b | Network switch connectivity | All devices pingable via GS308 | Ping sweep from Main Controller |
| IT-1.2.2c | Service interdependency | All services survive gpsd restart | Restart gpsd, verify other services |
| IT-1.2.2d | Log aggregation | All service logs accessible via journalctl | `journalctl -u scanner-ui`, etc. |

#### 1.3 Environmental Tests

##### ET-1.3.1: Thermal Performance
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| ET-1.3.1a | Idle temperature | CPU < 60°C at 25°C ambient | `vcgencmd measure_temp` |
| ET-1.3.1b | Load temperature | CPU < 80°C under sustained load | stress-ng + temp monitoring |
| ET-1.3.1c | Hot soak | System stable after 2 hours at 40°C ambient | Climate chamber or hot vehicle |
| ET-1.3.1d | No thermal throttling | No throttling during normal operation | `vcgencmd get_throttled` returns 0 |

##### ET-1.3.2: Vehicle Deployment
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| ET-1.3.2a | Vibration tolerance | No USB disconnects during 30-min drive | Monitor dmesg for USB errors |
| ET-1.3.2b | Power stability | No brownouts during engine start | Monitor 5V rail with multimeter/scope |
| ET-1.3.2c | Extended operation | 2-hour driving test without failures | Full system monitoring |
| ET-1.3.2d | Display visibility | Screen readable in direct sunlight | Subjective assessment + photo |
| ET-1.3.2e | Touch accuracy | Touch targets hit accurately while parked | 20 touch target test |

##### ET-1.3.3: Power System
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| ET-1.3.3a | Input voltage range | System operates 10.5V - 14.4V | Bench power supply test |
| ET-1.3.3b | Current draw idle | < 2A at 12V idle | Inline ammeter |
| ET-1.3.3c | Current draw peak | < 8A at 12V peak | Inline ammeter during boot |
| ET-1.3.3d | Power loss recovery | Clean boot after hard power cut | Pull power, restore, verify |

#### 1.4 Acceptance Criteria

| ID | Requirement | Verification |
|----|-------------|--------------|
| AC-1.1 | Scanner UI displays frequency within 500ms of change | IT-1.2.1a |
| AC-1.2 | System survives 2-hour driving test without issues | ET-1.3.2c |
| AC-1.3 | System boots to operational state within 90 seconds | UT-1.1.1b |
| AC-1.4 | GPS achieves fix within 60 seconds outdoors | UT-1.1.2b |
| AC-1.5 | Kismet detects WiFi devices | UT-1.1.4c |
| AC-1.6 | All services auto-restart on failure | IT-1.2.2c verification |

#### 1.5 Rollback Procedure

If Phase 1 gate fails:

1. **Document failure mode** - Capture logs, screenshots, measurements
2. **Isolate failing component** - Determine if hardware or software
3. **Revert software changes** - `git checkout` to last known good
4. **Hardware swap if needed** - Replace suspected component
5. **Retest failed criteria only** - Don't repeat passing tests
6. **Root cause analysis** - Document in project log before retry

#### 1.6 Sign-off Requirements

| Role | Responsibility | Signature |
|------|----------------|-----------|
| Project Lead | Verify all tests executed | __________ |
| Hardware Integrator | Confirm vehicle installation | __________ |
| Software Developer | Confirm code baseline tagged | __________ |

**Phase 1 Gate Status:** ☐ PASS / ☐ FAIL

**Date:** __________ **Approved by:** __________

---

## Phase 2: KrakenSDR Integration

### Gate 2: Direction Finding Operational

#### 2.1 Unit Tests

##### UT-2.1.1: KrakenSDR Hardware
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-2.1.1a | USB enumeration | All 5 RTL-SDR channels detected | `lsusb` shows 5 RTL2838 devices |
| UT-2.1.1b | Noise floor | Noise floor < -60 dBm per channel | KrakenSDR calibration tool |
| UT-2.1.1c | Channel coherence | Phase coherence achieved | Calibration passes |
| UT-2.1.1d | Sample rate stability | Stable 2.4 MSPS across all channels | Monitor sample rate for 10 min |

##### UT-2.1.2: KrakenSDR Software
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-2.1.2a | DOA service startup | krakensdr_doa running after boot | `systemctl status krakensdr_doa` |
| UT-2.1.2b | Web UI responsive | DOA UI accessible on port 8080 | HTTP GET response |
| UT-2.1.2c | API endpoint | /settings endpoint accepts POST | curl test |
| UT-2.1.2d | WebSocket stream | /ws provides real-time DOA data | WebSocket client test |

##### UT-2.1.3: Antenna Array
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-2.1.3a | Antenna continuity | All 5 antennas show < 2:1 SWR at test freq | VNA or SWR meter |
| UT-2.1.3b | Array geometry | Array matches calibration geometry | Physical measurement |
| UT-2.1.3c | Cable phase match | Cable lengths within 5mm | Measure and document |

#### 2.2 Integration Tests

##### IT-2.2.1: Scanner-to-Kraken Handoff
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-2.2.1a | API communication | Scanner-UI can POST to Kraken API | Log analysis |
| IT-2.2.1b | Frequency handoff latency | Kraken tunes within 500ms of handoff | Timestamp comparison |
| IT-2.2.1c | One-button DF | Touch button triggers complete handoff | End-to-end test |
| IT-2.2.1d | Return to scanner | DF session can be terminated cleanly | UI test |

##### IT-2.2.2: Bearing Display Integration
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-2.2.2a | Bearing on driving UI | Bearing displayed in scanner-ui | Visual verification |
| IT-2.2.2b | Confidence indicator | Confidence level shown | Visual verification |
| IT-2.2.2c | Update rate | Bearing updates at ≥ 2 Hz | Count updates over 10 seconds |
| IT-2.2.2d | GPS integration | Bearing line georeferenced | Verify on map display |

#### 2.3 Performance Tests

##### PT-2.3.1: Direction Finding Accuracy
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| PT-2.3.1a | Known source - 0° | Bearing within ±10° of true | Test signal at known position |
| PT-2.3.1b | Known source - 90° | Bearing within ±10° of true | Test signal at known position |
| PT-2.3.1c | Known source - 180° | Bearing within ±10° of true | Test signal at known position |
| PT-2.3.1d | Known source - 270° | Bearing within ±10° of true | Test signal at known position |
| PT-2.3.1e | Mobile test | Bearing tracks moving source | Drive test with handheld |
| PT-2.3.1f | Multipath resilience | Reasonable bearing in urban area | Urban test |

##### PT-2.3.2: System Performance Under DF Load
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| PT-2.3.2a | CPU utilization | Kraken host < 80% CPU during DF | top/htop monitoring |
| PT-2.3.2b | Memory utilization | < 6GB RAM used on Kraken host | free -h monitoring |
| PT-2.3.2c | Main controller impact | Scanner-UI latency unchanged during DF | Benchmark comparison |
| PT-2.3.2d | Network bandwidth | < 10 Mbps between Kraken and Main | iftop measurement |

#### 2.4 Acceptance Criteria

| ID | Requirement | Verification |
|----|-------------|--------------|
| AC-2.1 | Kraken tunes to frequency within 500ms | IT-2.2.1b |
| AC-2.2 | Bearing accuracy within 10° on test signal | PT-2.3.1a-d |
| AC-2.3 | One-button DF handoff functional | IT-2.2.1c |
| AC-2.4 | Bearing displayed on driving UI | IT-2.2.2a |
| AC-2.5 | System stable during 1-hour DF session | Extended run test |

#### 2.5 Rollback Procedure

If Phase 2 gate fails:

1. **Isolate Kraken subsystem** - Disconnect Kraken host from network
2. **Verify Phase 1 still operational** - Run Phase 1 spot checks
3. **Diagnose Kraken issues independently** - Bench test Kraken setup
4. **Common issues checklist:**
   - USB power insufficient → Add powered hub
   - Calibration drift → Recalibrate in controlled environment
   - Network conflict → Verify IP assignments
5. **Do not proceed to Phase 3 until AC-2.1 through AC-2.5 pass**

#### 2.6 Sign-off Requirements

| Role | Responsibility | Signature |
|------|----------------|-----------|
| Project Lead | Verify bearing accuracy tests | __________ |
| RF Engineer | Confirm antenna calibration | __________ |

**Phase 2 Gate Status:** ☐ PASS / ☐ FAIL

**Date:** __________ **Approved by:** __________

---

## Phase 3: ADS-B Station

### Gate 3: ADS-B Integration Complete

#### 3.1 Unit Tests

##### UT-3.1.1: ADS-B Hardware
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-3.1.1a | RTL-SDR detection | V4 dongle detected | `lsusb` |
| UT-3.1.1b | 1090 MHz filter insertion loss | < 3 dB at 1090 MHz | VNA if available |
| UT-3.1.1c | LNA gain | 20-25 dB at 1090 MHz | Spec verification |
| UT-3.1.1d | Antenna SWR | < 2:1 at 1090 MHz | SWR meter |

##### UT-3.1.2: ADS-B Software
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-3.1.2a | readsb service | Running and decoding | `systemctl status readsb` |
| UT-3.1.2b | tar1090 accessible | Web UI loads | HTTP GET to /tar1090/ |
| UT-3.1.2c | Aircraft count | Detects aircraft within 5 min | tar1090 aircraft count |
| UT-3.1.2d | Position messages | Receiving position messages | stats.json verification |

#### 3.2 Integration Tests

##### IT-3.2.1: Dashboard Integration
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-3.2.1a | Link from main dashboard | tar1090 accessible via dashboard | Click test |
| IT-3.2.1b | Cross-origin access | No CORS errors | Browser console check |
| IT-3.2.1c | Position correlation | Aircraft positions relative to vehicle GPS | Visual verification |

##### IT-3.2.2: Network Integration
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-3.2.2a | Static IP | ADS-B station at 192.168.1.52 | ping test |
| IT-3.2.2b | Beast output | Port 30005 accessible from Main Controller | netcat test |
| IT-3.2.2c | JSON API | Aircraft.json accessible remotely | curl test |

#### 3.3 Performance Tests

##### PT-3.3.1: Reception Performance
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| PT-3.3.1a | Message rate | > 100 msg/sec in typical location | readsb stats |
| PT-3.3.1b | Range | > 100 NM range achieved | tar1090 range rings |
| PT-3.3.1c | Aircraft tracked | > 20 simultaneous aircraft (varies by location) | tar1090 count |
| PT-3.3.1d | Position message % | > 30% of messages contain position | stats.json |

#### 3.4 Acceptance Criteria

| ID | Requirement | Verification |
|----|-------------|--------------|
| AC-3.1 | ADS-B station accessible via dashboard | IT-3.2.1a |
| AC-3.2 | Aircraft displayed on tar1090 map | UT-3.1.2c |
| AC-3.3 | Distance/bearing to aircraft calculated | Manual verification |
| AC-3.4 | System operates standalone | Power cycle test |

#### 3.5 Rollback Procedure

Phase 3 is largely independent. Failure does not impact Phase 1 or 2 operation.

1. **Verify ADS-B station network connectivity**
2. **Check USB device detection**
3. **Verify gain settings** - May need optimization for local RF environment
4. **Common issues:**
   - Overloaded front-end → Reduce gain
   - Poor antenna location → Relocate or add ground plane
   - Network misconfiguration → Verify static IP settings

#### 3.6 Sign-off Requirements

| Role | Responsibility | Signature |
|------|----------------|-----------|
| Project Lead | Verify aircraft tracking | __________ |

**Phase 3 Gate Status:** ☐ PASS / ☐ FAIL

**Date:** __________ **Approved by:** __________

---

## Phase 4: Sensor Mesh Network

### Gate 4: Sensor Mesh Functional

#### 4.1 Unit Tests

##### UT-4.1.1: WiFi Access Point
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-4.1.1a | hostapd running | AP broadcasting SensorMesh SSID | `iw dev` and hostapd status |
| UT-4.1.1b | DHCP operational | Clients receive 10.0.0.x addresses | Connect test client |
| UT-4.1.1c | DNS resolution | .local names resolve | nslookup test |
| UT-4.1.1d | Client capacity | 20 simultaneous clients supported | Load test |

##### UT-4.1.2: MQTT Broker
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-4.1.2a | Mosquitto running | Broker accepting connections | mosquitto_sub test |
| UT-4.1.2b | Authentication | Anonymous rejected, auth required | Connection test |
| UT-4.1.2c | QoS 1 delivery | Messages with QoS 1 acknowledged | MQTT client test |
| UT-4.1.2d | Persistence | Messages survive broker restart | Restart test |

##### UT-4.1.3: Data Pipeline
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-4.1.3a | InfluxDB running | Database accepting writes | influx CLI test |
| UT-4.1.3b | Grafana running | Web UI accessible on port 3000 | HTTP GET |
| UT-4.1.3c | MQTT-to-InfluxDB | MQTT messages appear in InfluxDB | End-to-end test |
| UT-4.1.3d | Grafana dashboards | Dashboards display sensor data | Visual verification |

##### UT-4.1.4: Sensor Nodes
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-4.1.4a | ESP32 WiFi probe scanner | Detects and reports probe requests | Monitor MQTT topic |
| UT-4.1.4b | Zero 2W Kismet remote | Remote capture source visible | Kismet UI verification |
| UT-4.1.4c | rtl_433 ISM decoder | Decodes test device (TPMS/weather) | MQTT message verification |
| UT-4.1.4d | Battery runtime | > 4 hours on battery | Discharge test |

#### 4.2 Integration Tests

##### IT-4.2.1: Sensor Communication
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-4.2.1a | ESP32 to MQTT | Messages arrive at broker | Subscribe and monitor |
| IT-4.2.1b | Zero 2W to Kismet | Devices appear in central Kismet | Kismet database query |
| IT-4.2.1c | rtl_433 to MQTT | ISM decodes published | Monitor sensors/ism/# |
| IT-4.2.1d | Message format | All messages include device_id, timestamp | Schema validation |

##### IT-4.2.2: Mesh Resilience
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-4.2.2a | Node reconnection | Node reconnects after AP restart | Restart AP, verify |
| IT-4.2.2b | Message buffering | No message loss during brief disconnect | Count messages |
| IT-4.2.2c | Multiple node handling | 10 nodes reporting simultaneously | Load test |

#### 4.3 Performance Tests

##### PT-4.3.1: Throughput
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| PT-4.3.1a | MQTT message rate | > 1000 messages/second sustained | Load generator |
| PT-4.3.1b | MQTT latency | < 100ms from publish to subscribe | Timestamp comparison |
| PT-4.3.1c | InfluxDB write rate | > 500 points/second | Write load test |
| PT-4.3.1d | Grafana query performance | Dashboard loads < 3 seconds | Stopwatch |

##### PT-4.3.2: Range
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| PT-4.3.2a | WiFi range (clear) | > 50m with reliable connection | Range test |
| PT-4.3.2b | WiFi range (obstructed) | > 20m through walls | Indoor test |
| PT-4.3.2c | Packet loss at range | < 5% at maximum usable range | iperf test |

#### 4.4 Acceptance Criteria

| ID | Requirement | Verification |
|----|-------------|--------------|
| AC-4.1 | WiFi AP supports 20 concurrent sensors | UT-4.1.1d |
| AC-4.2 | MQTT latency < 100ms | PT-4.3.1b |
| AC-4.3 | Sensor data visible in Grafana | UT-4.1.3d |
| AC-4.4 | ESP32 nodes report WiFi probes | IT-4.2.1a |
| AC-4.5 | Zero 2W remote capture functional | IT-4.2.1b |
| AC-4.6 | rtl_433 decoding TPMS/ISM devices | UT-4.1.4c |

#### 4.5 Rollback Procedure

1. **Disable sensor mesh AP** - Prevents interference with main network
2. **Verify Phase 1-3 operation** - Core functions unaffected
3. **Debug sensor mesh in isolation:**
   - Test MQTT broker standalone
   - Test AP without MQTT
   - Test one sensor node at a time
4. **Common issues:**
   - IP conflicts → Verify DHCP range doesn't overlap
   - WiFi channel interference → Change AP channel
   - MQTT authentication → Reset credentials

#### 4.6 Sign-off Requirements

| Role | Responsibility | Signature |
|------|----------------|-----------|
| Project Lead | Verify sensor data flow | __________ |
| Network Engineer | Confirm mesh stability | __________ |

**Phase 4 Gate Status:** ☐ PASS / ☐ FAIL

**Date:** __________ **Approved by:** __________

---

## Phase 5: HaLow Mesh + Advanced Integration

### Gate 5: Full System Integration

#### 5.1 Unit Tests

##### UT-5.1.1: HaLow Hardware
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-5.1.1a | HaLowLink boot | OpenWRT boots successfully | Serial console check |
| UT-5.1.1b | 915 MHz radio | HaLow interface detected | `iw dev` |
| UT-5.1.1c | 2.4 GHz radio | WiFi AP interface available | `iw dev` |
| UT-5.1.1d | Ethernet | eth0 connected at 1 Gbps | `ethtool eth0` |

##### UT-5.1.2: HaLow Networking
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-5.1.2a | Mesh formation | Vehicle and home nodes discover each other | Mesh status check |
| UT-5.1.2b | IP routing | 172.16.0.x routes established | `ip route` verification |
| UT-5.1.2c | Guest AP isolation | Guest cannot reach 192.168.1.x | Routing test |
| UT-5.1.2d | HaLow throughput | > 1 Mbps at 100m | iperf test |

##### UT-5.1.3: WAN Failover
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| UT-5.1.3a | Starlink primary | Default route via Starlink | `ip route` |
| UT-5.1.3b | Failover trigger | HaLow becomes default when Starlink fails | Disconnect Starlink |
| UT-5.1.3c | Failover timing | < 30 seconds to failover | Stopwatch |
| UT-5.1.3d | Failback | Starlink resumes when available | Reconnect Starlink |
| UT-5.1.3e | Failback hysteresis | No flapping with unstable Starlink | Simulate intermittent |

#### 5.2 Integration Tests

##### IT-5.2.1: Full System Integration
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-5.2.1a | Unified dashboard | All subsystems accessible | Navigate all links |
| IT-5.2.1b | Cross-system data flow | Scanner → Kraken → Dashboard | End-to-end trace |
| IT-5.2.1c | Sensor data via HaLow | Remote sensor data via mesh | Deploy sensor via HaLow |
| IT-5.2.1d | GPS everywhere | GPS data available to all components | Verify timestamps |

##### IT-5.2.2: GridDown Operation
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-5.2.2a | No-internet operation | All local services functional | Disconnect all WAN |
| IT-5.2.2b | Local DNS | .local names resolve without internet | DNS test |
| IT-5.2.2c | Local time | System time maintained via GPS | Disconnect NTP, verify |
| IT-5.2.2d | Data logging | Data continues to be logged | Verify InfluxDB writes |
| IT-5.2.2e | Mesh-only operation | HaLow mesh functional without Starlink | Mesh ping test |

##### IT-5.2.3: Security Verification
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| IT-5.2.3a | Guest isolation | Guest WiFi cannot reach internal | nmap scan from guest |
| IT-5.2.3b | MQTT authentication | Unauthenticated publish rejected | mosquitto_pub test |
| IT-5.2.3c | SSH key-only | Password authentication rejected | SSH test |
| IT-5.2.3d | Web services local-only | No services exposed to WAN | External port scan |
| IT-5.2.3e | HaLow encryption | WPA3-SAE verified | iw scan analysis |

#### 5.3 Performance Tests

##### PT-5.3.1: End-to-End Performance
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| PT-5.3.1a | Dashboard load time | < 3 seconds | Stopwatch |
| PT-5.3.1b | Scanner-to-display latency | < 500ms | Timestamp analysis |
| PT-5.3.1c | DF bearing update rate | ≥ 2 Hz | Count over 10 seconds |
| PT-5.3.1d | Total system power | < 100W peak | Clamp ammeter |

##### PT-5.3.2: HaLow Range
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| PT-5.3.2a | LOS range | > 500m with > 1 Mbps | Drive test |
| PT-5.3.2b | NLOS range | > 200m through buildings | Urban test |
| PT-5.3.2c | Mobile operation | Mesh maintains during movement | Drive test |

##### PT-5.3.3: Extended Operation
| Test ID | Description | Pass Criteria | Method |
|---------|-------------|---------------|--------|
| PT-5.3.3a | 8-hour continuous | No failures or restarts required | Monitoring log |
| PT-5.3.3b | Memory stability | No memory leaks (RAM stable) | 8-hour RAM plot |
| PT-5.3.3c | Disk space | < 1 GB/day data growth | df monitoring |
| PT-5.3.3d | Thermal stability | Temperatures stable over 8 hours | Temp log |

#### 5.4 Acceptance Criteria

| ID | Requirement | Verification |
|----|-------------|--------------|
| AC-5.1 | HaLow mesh operational at 500m | PT-5.3.2a |
| AC-5.2 | WAN failover < 30 seconds | UT-5.1.3c |
| AC-5.3 | Guest AP isolated from internal | IT-5.2.3a |
| AC-5.4 | GridDown operation functional | IT-5.2.2a-e |
| AC-5.5 | Unified dashboard complete | IT-5.2.1a |
| AC-5.6 | 8-hour continuous operation | PT-5.3.3a |
| AC-5.7 | All security requirements met | IT-5.2.3a-e |

#### 5.5 Rollback Procedure

Phase 5 failures should not impact Phase 1-4 operation.

1. **Disconnect HaLowLink from network**
2. **Verify core system (Phase 1-4) operational**
3. **Debug HaLow subsystem:**
   - Verify OpenWRT configuration
   - Check 915 MHz regulatory settings
   - Test mesh formation with 2 nodes first
4. **Common issues:**
   - Regulatory domain → Verify 915 MHz legal in your region
   - Mesh routing → Simplify to 2-node test
   - Failover script → Test manually first

#### 5.6 Final System Acceptance

##### Full System Validation Checklist

| # | Validation Item | Result |
|---|-----------------|--------|
| 1 | Cold boot to operational < 90 seconds | ☐ |
| 2 | Scanner UI responsive and accurate | ☐ |
| 3 | KrakenSDR DF bearing accurate ±10° | ☐ |
| 4 | ADS-B tracking aircraft | ☐ |
| 5 | Sensor mesh receiving data | ☐ |
| 6 | HaLow mesh at rated range | ☐ |
| 7 | WAN failover functional | ☐ |
| 8 | GridDown operation verified | ☐ |
| 9 | 8-hour continuous test passed | ☐ |
| 10 | All security controls verified | ☐ |
| 11 | Documentation complete | ☐ |
| 12 | Operator trained | ☐ |

#### 5.7 Sign-off Requirements

| Role | Responsibility | Signature |
|------|----------------|-----------|
| Project Lead | Overall system acceptance | __________ |
| Hardware Integrator | Vehicle installation final | __________ |
| Software Developer | Code baseline frozen | __________ |
| Network Engineer | Mesh and failover verified | __________ |
| Security Reviewer | Security controls verified | __________ |

**Phase 5 Gate Status:** ☐ PASS / ☐ FAIL

**SYSTEM OPERATIONAL STATUS:** ☐ APPROVED FOR DEPLOYMENT

**Date:** __________ **Final Approval:** __________

---

## Appendix A: Test Equipment Required

| Equipment | Purpose | Phases |
|-----------|---------|--------|
| Multimeter | Voltage/current measurements | 1-5 |
| USB ammeter | Power consumption | 1-5 |
| SWR meter / VNA | Antenna verification | 2, 3 |
| Test signal generator | DF calibration | 2 |
| Handheld radio | DF testing | 2 |
| Network switch/hub | Traffic monitoring | 4, 5 |
| Laptop with WiFi | Client testing | 4, 5 |
| GPS reference receiver | Position accuracy | 1 |
| Stopwatch | Timing measurements | All |
| Temperature logger | Thermal monitoring | 1, 5 |

## Appendix B: Test Data Retention

| Data Type | Retention | Format |
|-----------|-----------|--------|
| Test results | Permanent | Signed PDF |
| Configuration snapshots | Per phase | Git tag |
| Performance logs | 90 days | CSV/JSON |
| Failure analysis | Permanent | Markdown |
| Sign-off sheets | Permanent | Signed PDF |

## Appendix C: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-20 | Claude | Initial release |
