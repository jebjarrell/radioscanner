# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## On-the-Go RF Awareness Scanner

### Version 1.0 MVP - Linux (Ubuntu/Debian)

**Document Version:** 2.0  
**Last Updated:** October 16, 2025  
**Status:** Final for Development

---

## Executive Summary

The On-the-Go RF Awareness Scanner is a field-deployable desktop application that provides everyday citizens with simple, plug-and-play access to radio frequency (RF) awareness. The application transforms complex SDR (Software Defined Radio) hardware into an intuitive tool that requires minimal training, following the Pareto Principle of delivering 80% of capabilities with 20% of the learning curve.

**Primary Goal:** Enable non-technical users to monitor aircraft, drones, and radio communications in their area using affordable SDR hardware with a single, unified interface.

**Target Release:** MVP v1.0 (Linux), followed by v1.5 (Windows), then v2.0 (advanced features)

---

## Product Vision

Create a unified RF awareness platform that makes professional-grade spectrum monitoring accessible to everyday users without requiring deep technical knowledge of radio, electronics, or SDR configuration.

### Guiding Principles

1. **Plug-and-Play:** Users plug in hardware, select data sources, and hit "Scan"
2. **Visual First:** Map-based interface shows _where_ things are, not just _what_ they are
3. **Progressive Disclosure:** Simple by default, advanced features accessible but not required
4. **Privacy-Conscious:** Session-only data storage, user controls exports
5. **Legal Compliance:** Passive monitoring only, respects FCC regulations

---

## Target Users & Personas

### Primary Persona: "Curious Citizen Chris"

**Demographics:**

- Age: 25-55
- Technical proficiency: Basic (can install software, use smartphone apps)
- Not a radio hobbyist, electrical engineer, or IT professional

**Motivations:**

- Wants general situational awareness of RF activity in their area
- Interested in tracking aircraft overhead
- Concerned about drone activity near property
- Curious about radio communications but intimidated by complex SDR software

**Pain Points:**

- Existing SDR software (GQRX, SDR#, CubicSDR) requires deep technical knowledge
- Too many separate tools (DUMP1090 for aircraft, Kismet for WiFi, different apps for scanning)
- Configuration files, command-line interfaces, frequency tables
- No unified view of "what's happening around me"

**Success Scenario:**
Chris buys an RTL-SDR dongle online. They install the On-the-Go Scanner, plug in the dongle, click "Scan," and immediately see aircraft flying overhead on a map, along with active radio frequencies in their area. No frequency lists to download, no drivers to configure manually, no separate applications to juggle.

### Secondary Persona: "Emergency Responder Emma"

**Demographics:**

- Age: 30-50
- Role: Volunteer SAR, Community Emergency Response Team (CERT), Amateur Radio operator
- Technical proficiency: Moderate

**Motivations:**

- Needs quick RF situational awareness during emergency deployments
- Wants to monitor multiple bands simultaneously
- Requires reliable operation in field conditions (vehicle-based)

**Pain Points:**

- Current tools require laptop + multiple programs + internet connection
- Setup time is too long when responding to incidents
- Needs offline operation (no cell service in remote areas)

---

## User Stories & Acceptance Criteria

### Epic 1: Initial Setup & Device Detection

#### US-1.1: Easy Installation

**As a** new user  
**I want to** install the application with minimal technical steps  
**So that** I can start using it quickly without troubleshooting

**Acceptance Criteria:**

- User runs `setup.sh` with sudo, script installs all dependencies
- Script installs: DUMP1090, Kismet, SoapySDR (Deferred to vNext), gpsd, required drivers
- Script provides clear success/failure messages
- README.txt explains installation requirements
- Installation completes in <5 minutes on typical system

#### US-1.2: Automatic Hardware Detection

**As a** user  
**I want** my SDR and GPS hardware to be automatically detected  
**So that** I don't have to configure device paths or settings manually

**Acceptance Criteria:**

- App detects RTL-SDR devices on launch
- App detects HackRF devices on launch
- App detects GPS dongle via gpsd
- If multiple SDRs present, user sees device picker dropdown
- Device picker shows device type (RTL-SDR v3, HackRF One, etc.)
- If no devices found, clear error message explains what to check

---

### Epic 2: Aircraft Monitoring (ADS-B

**Note:** Use dump1090 HTTP JSON at `/data/aircraft.json` (default port 8080). Port 30003 is the SBS text feed and requires a line parser.)

#### US-2.1: View Aircraft on Map

**As a** user  
**I want to** see aircraft in my area displayed on a map  
**So that** I can understand air traffic around me

**Acceptance Criteria:**

- Map displays all aircraft detected by DUMP1090
- Each aircraft shown as icon with callsign label
- Clicking aircraft icon shows details: altitude, speed, heading
- Aircraft positions update in real-time (<2 second latency)
- Aircraft icons disappear when signal lost (last_seen > 60 seconds)
- Map centered on user's GPS location
- User can pan/zoom map freely

#### US-2.2: Aircraft List View

**As a** user  
**I want to** see a list of detected aircraft with key details  
**So that** I can quickly scan multiple aircraft without clicking map icons

**Acceptance Criteria:**

- Sidebar or panel shows list of all active aircraft
- List includes: callsign, altitude, speed, distance from user
- List sorted by distance (closest first) by default
- User can sort by: callsign, altitude, speed
- List updates in real-time
- Clicking list item highlights aircraft on map

---

### Epic 3: Drone Detection (Remote ID)

#### US-3.1: Detect Drones via Remote ID

**As a** user  
**I want to** see drones broadcasting Remote ID in my area  
**So that** I'm aware of drone operations nearby

**Acceptance Criteria:**

- Kismet configured to monitor Bluetooth for Remote ID broadcasts
- App filters Kismet output for Remote ID packets only
- Drone appears on map within 2 seconds of detection
- Drone icon distinct from aircraft icon
- Drone label shows: manufacturer, model (if available)

#### US-3.2: Display Drone Operator Location

**As a** user  
**I want to** see where the drone operator is located  
**So that** I understand who is flying the drone

**Acceptance Criteria:**

- Operator location extracted from Remote ID payload
- Operator shown on map as separate icon
- Line drawn between drone and operator on map
- Operator info panel shows: distance from user, accuracy estimate
- If operator location unavailable, show "Operator: Unknown"

#### US-3.3: Drone Details Panel

**As a** user  
**I want to** click a drone icon to see detailed information  
**So that** I can understand the drone's flight profile

**Acceptance Criteria:**

- Click drone icon opens detail panel
- Panel shows: drone ID, manufacturer, model, altitude, speed, heading
- Panel shows: operator location (if available)
- Panel shows: time first detected, last update time
- Panel includes "Export Drone Log" button for this specific drone

---

### Epic 4: RF Spectrum Scanning

#### US-4.1: Select Band to Scan

**As a** user  
**I want to** choose which frequency band to monitor  
**So that** I can focus on communications I'm interested in

**Acceptance Criteria:**

- Dropdown menu lists available bands:
  - Airband (108-137 MHz)
  - Marine VHF (156-162 MHz)
  - NOAA Weather (162.4-162.55 MHz)
  - FRS/GMRS (462-467 MHz)
  - CB (26.965-27.405 MHz)
  - Ham 2m (144-148 MHz)
  - Ham 70cm (420-450 MHz)
- Selecting band updates waterfall display frequency range
- Band selection persists between app sessions
- Tooltip explains what each band is used for

#### US-4.2: Waterfall Visualization

**As a** user  
**I want to** see a waterfall display of the selected frequency band  
**So that** I can visually identify active signals

**Acceptance Criteria:**

- Waterfall display collapsed by default (hidden)
- "Start Scan" button begins spectrum scanning
- Waterfall updates at 10 Hz
- Color scale: blue (no signal) → green → yellow → red (strong signal)
- Frequency labels on X-axis
- Time scrolls downward (standard waterfall convention)
- "Stop Scan" button pauses scanning (saves CPU)
- Waterfall view can be collapsed to save screen space

#### US-4.3: Signal Detection & Logging

**As a** user  
**I want** strong signals to be automatically detected and logged  
**So that** I can review active communications later

**Acceptance Criteria:**

- Signals above threshold (-40 dBm or configurable) are logged to SQLite
- Dashboard shows count of active signals
- Signal list view shows: frequency, signal strength, band name, time detected
- User can click signal in list to center waterfall on that frequency
- Signals older than current session are not shown (session-only storage)

---

### Epic 5: Dashboard & Statistics

#### US-5.1: Real-Time Statistics Panel

**As a** user  
**I want to** see summary statistics of detected RF activity  
**So that** I can quickly assess the current RF environment

**Acceptance Criteria:**

- Dashboard panel shows three sections:
  - **Aircraft Detected:** Total count, breakdown by type (commercial/private if detectable)
  - **Drones Detected:** Total count, breakdown by manufacturer (DJI, Autel, etc.)
  - **RF Signals Active:** Total count, breakdown by band
- Statistics update in real-time
- "Active Band" dropdown in dashboard for quick band switching
- "Scan" start/stop button in dashboard
- "Export Data" button in dashboard

---

### Epic 6: Data Management

#### US-6.1: Session-Only Data Storage

**As a** user  
**I want** data to be automatically deleted when I close the app  
**So that** I'm not storing RF logs indefinitely without my knowledge

**Acceptance Criteria:**

- SQLite database cleared on application exit
- User sees confirmation: "Data will be cleared on exit. Export now?"
- If user cancels exit, app remains open and data retained
- No persistent storage of RF signals, aircraft, or drones across sessions

#### US-6.2: Export Data Before Exit

**As a** user  
**I want to** export my session data before closing the app  
**So that** I can keep records of interesting RF activity

**Acceptance Criteria:**

- "Export Data" button in dashboard
- Export creates three CSV files:
  - `aircraft_YYYYMMDD_HHMMSS.csv`
  - `drones_YYYYMMDD_HHMMSS.csv`
  - `rf_signals_YYYYMMDD_HHMMSS.csv`
- User selects save location via file picker
- Export includes all session data up to export moment
- Success message: "Data exported to [path]"
- Export does NOT clear session data (user can continue monitoring)

---

### Epic 7: GPS & Location

#### US-7.1: GPS Location Display

**As a** user  
**I want** my current location displayed on the map  
**So that** I can orient myself and understand distances to detected objects

**Acceptance Criteria:**

- User location shown as distinct icon (e.g., blue dot)
- Location updates from GPS dongle via gpsd
- Update rate: 1 Hz (once per second)
- If GPS signal lost, icon shows "GPS: No Fix" status
- User location icon always visible (does not pan out of view)

#### US-7.2: Distance Calculations

**As a** user  
**I want** distances from my location to aircraft/drones displayed  
**So that** I can judge proximity without mental math

**Acceptance Criteria:**

- Aircraft/drone detail panels show distance in miles or kilometers
- User can toggle distance unit in settings
- Distance calculated using great-circle formula
- Distance updates in real-time as objects move
- Dashboard "nearest" sorting uses these calculations

---

## MVP Feature Set (In Scope for v1.0)

### Core Features

✅ **SDR Support:**

- RTL-SDR (all versions)
- HackRF One
- Unified interface via SoapySDR (Deferred to vNext)

✅ **Data Sources:**

- ADS-B

**Note:** Use dump1090 HTTP JSON at `/data/aircraft.json` (default port 8080). Port 30003 is the SBS text feed and requires a line parser. aircraft tracking (via DUMP1090)

- Drone Remote ID detection (via Kismet Bluetooth)
- RF spectrum scanning (via SoapySDR (Deferred to vNext))

✅ **Visualization:**

- Map view with aircraft, drones, user location (MapLibre GL JS)
- Waterfall spectrum display (10 Hz update rate)
- Real-time dashboard statistics

✅ **Bands (Hardcoded):**

- Airband (108-137 MHz)
- Marine VHF (156-162 MHz)
- NOAA Weather (162.4-162.55 MHz)
- FRS/GMRS (462-467 MHz)
- CB (26.965-27.405 MHz)
- Ham 2m (144-148 MHz)
- Ham 70cm (420-450 MHz)

✅ **Data Management:**

- Session-only SQLite storage
- CSV export before exit
- No persistent logs

✅ **Hardware:**

- USB GPS dongle support (DeLorme 9838, Arduino GPS modules)
- Laptop integrated Bluetooth for Remote ID

✅ **Platform:**

- Ubuntu 20.04+
- Debian 11+

---

## Out of Scope (v1.5 and v2.0)

### v1.5 Features (Windows Port)

❌ Windows .exe installer with bundled dependencies  
❌ Windows-specific driver handling  
❌ Cross-platform build automation

### v2.0 Features

❌ Alert system (proximity alerts, emergency frequency alerts, audio notifications)  
❌ Custom CSV frequency import  
❌ RadioReference integration  
❌ WiFi wardriving (network SSID/MAC collection)  
❌ BLE advertising collection (non-Remote ID devices)  
❌ NRF5340/ESP32 integration for enhanced BLE reception  
❌ Direction-of-arrival (DOA) calculations for drone location verification  
❌ Additional SDR support (USRP, Airspy, etc.)  
❌ Click-to-tune on waterfall (interactive frequency selection)  
❌ Audio demodulation (listen to signals)  
❌ Trunked radio system tracking  
❌ APRS integration  
❌ Integration with external feeds (Kraken, ADS-B

**Note:** Use dump1090 HTTP JSON at `/data/aircraft.json` (default port 8080). Port 30003 is the SBS text feed and requires a line parser. Exchange)  
❌ Mobile app (Android/iOS)

---

## Non-Functional Requirements

### Performance

- **Map Update Latency:** <2 seconds from detection to display
- **Waterfall Frame Rate:** 10 Hz minimum
- **CPU Usage:** <50% on Intel Core i5-6200U (2015 laptop) during active scanning
- **RAM Usage:** <1 GB
- **Startup Time:** <10 seconds from launch to usable interface
- **GPS Update Rate:** 1 Hz

### Reliability

- **Crash Recovery:** App gracefully handles disconnected USB devices
- **Data Integrity:** No corrupted SQLite writes on abnormal exit
- **Service Dependencies:** App displays clear status if DUMP1090/Kismet not running

### Usability

- **First-Time Setup:** User completes setup in <10 minutes following README
- **Learning Curve:** User successfully detects aircraft within 5 minutes of first launch
- **Error Messages:** All errors include actionable troubleshooting steps

### Security & Privacy

- **No Remote Telemetry:** App does not phone home or send usage data
- **Local Storage Only:** All data stored on user's device
- **No Authentication:** No accounts, logins, or cloud services required

### Compatibility

- **Linux Kernel:** 5.4+ (Ubuntu 20.04, Debian 11 minimum)
- **Bluetooth:** Bluetooth 4.0+ required for Remote ID
- **USB Ports:** Minimum 2 USB ports (SDR + GPS)
- **Display:** 1280x720 minimum resolution

---

## Success Metrics

### Adoption Metrics

- **Primary:** 100 active users within 3 months of v1.0 release
- **Secondary:** 10 community contributions (bug reports, feature requests) on GitHub

### Usage Metrics

- **Session Duration:** Average >15 minutes per session (indicates engagement)
- **Feature Usage:** >70% of users activate waterfall view at least once
- **Export Frequency:** >30% of users export data before exit (indicates value)

### Quality Metrics

- **Crash Rate:** <5% of sessions end in crash
- **Setup Success Rate:** >90% of users complete setup.sh without errors
- **Detection Accuracy:**
  - Aircraft detection matches DUMP1090 raw output 100%
  - Drone Remote ID parsing matches Kismet output 100%

### User Satisfaction

- **Post-Use Survey:** >70% rate ease-of-use as "Good" or "Excellent"
- **NPS Score:** >40 (Net Promoter Score)

---

## UI Flow & Layout

### Application Window Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  On-the-Go RF Awareness Scanner                      [_][□][X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │               MAP VIEW (MapLibre GL JS)                   │  │
│  │                                                             │  │
│  │  • User location (blue dot)                               │  │
│  │  • Aircraft icons (plane symbols) with callsigns         │  │
│  │  • Drone icons (quadcopter symbols) with IDs             │  │
│  │  • Operator icons (person symbols)                       │  │
│  │  • Lines connecting drones to operators                  │  │
│  │                                                             │  │
│  │  [Zoom Controls]  [Center on Me]                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────┬───────────────┬───────────────┬──────────┐  │
│  │  Aircraft     │ Drones        │ RF Signals    │ Controls │  │
│  │  Detected     │ Detected      │ Active        │          │  │
│  ├───────────────┼───────────────┼───────────────┼──────────┤  │
│  │     12        │      3        │      45       │          │  │
│  │               │               │               │          │  │
│  │ ✈️ Commercial │ 🚁 DJI: 2     │ 📻 Airband:12 │ Active:  │  │
│  │    8          │ 🚁 Autel: 1   │ 📡 Marine: 8  │ [Airband]│  │
│  │ 🛩️ Private    │               │ 📻 Ham 2m: 25 │          │  │
│  │    4          │               │               │ [▶ Scan] │  │
│  │               │               │               │ [💾 Export]│
│  └───────────────┴───────────────┴───────────────┴──────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ▼ WATERFALL VIEW (Click to expand)                        │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │                                                             │  │
│  │  [Collapsed by default - Click ▶ Start Scan to begin]    │  │
│  │                                                             │  │
│  │  When active:                                             │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Frequency (MHz) →                                   │ │  │
│  │  │ ┌───────────────────────────────────────────────┐   │ │  │
│  │  │ │  [Spectrum waterfall display]                 │   │ │  │
│  │  │ │  Time ↓                                       │   │ │  │
│  │  │ │  (Blue = no signal, Red = strong signal)     │   │ │  │
│  │  │ └───────────────────────────────────────────────┘   │ │  │
│  │  │ [■ Stop]  10 Hz  │  Band: Airband (108-137 MHz)    │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Status: GPS ✅ | DUMP1090 ✅ | Kismet ✅ | SDR: RTL-SDR v3 ✅  │
└─────────────────────────────────────────────────────────────────┘
```

### User Flow: First Launch

1. User double-clicks app icon
2. App checks for DUMP1090, Kismet, gpsd services
3. If services not running, shows status panel:
   - "❌ DUMP1090: Not running. Start with: `sudo systemctl start dump1090`"
   - "❌ Kismet: Not running. Start with: `sudo systemctl start kismet`"
4. User starts services, clicks "Refresh Status"
5. App detects RTL-SDR via SoapySDR (Deferred to vNext)
6. App detects GPS via gpsd
7. Dashboard shows: "✅ Ready to scan"
8. User clicks "▶ Scan" button
9. Map populates with aircraft
10. Drones appear if any broadcasting Remote ID
11. User switches band to "Ham 2m" from dropdown
12. User clicks "▼ Waterfall View" to expand
13. User clicks "▶ Start Scan" in waterfall panel
14. Spectrum visualization begins
15. User monitors for 20 minutes
16. User clicks "💾 Export" → selects folder → data saved
17. User closes app → confirmation dialog → data cleared

---

## Technical Constraints & Assumptions

### Assumptions

1. User has sudo/root access for setup.sh installation
2. User's laptop has at least 2 available USB ports
3. Internet connection available during initial setup (for apt packages)
4. User operates in legal RF monitoring jurisdiction (passive reception is legal in US)
5. DUMP1090 and Kismet APIs are stable and will not break between versions
6. DJI drones are the primary drone target (Remote ID compliance)
7. GPS dongle provides NMEA-formatted output via gpsd

### Constraints

1. **Legal:** Passive monitoring only, no transmission capabilities
2. **Hardware:** Limited to USB-connected SDRs (no networked SDRs in MVP)
3. **Platform:** X11-based Linux desktop environments (no Wayland in MVP)
4. **Dependencies:** Requires external services (DUMP1090, Kismet, gpsd)
5. **Bluetooth Range:** Limited to ~100m for Remote ID detection (Bluetooth LE range)
6. **RTL-SDR Frequency Range:** 24-1766 MHz (CB band at 27 MHz may have reduced performance)

---

## Risks & Mitigation

| Risk                                                              | Impact | Probability | Mitigation                                                                                  |
| ----------------------------------------------------------------- | ------ | ----------- | ------------------------------------------------------------------------------------------- |
| Kismet Remote ID support incomplete                               | High   | Medium      | Test early with real DJI drone. Fallback: custom BT parser using opendroneid-core-c library |
| RTL-SDR driver conflicts with other software                      | Medium | Medium      | Document known conflicts (SDR++, GQRX). Provide instructions to stop other SDR apps.        |
| GPS dongle not detected by gpsd                                   | Medium | Low         | Provide troubleshooting guide. Support multiple GPS models.                                 |
| Map tiles require internet connection                             | Low    | High        | Bundle offline map tiles in v1.5. For MVP, document internet requirement.                   |
| HackRF sensitivity lower than RTL-SDR                             | Low    | Medium      | Set user expectations. Recommend RTL-SDR for airband/marine, HackRF for wideband.           |
| SoapySDR (Deferred to vNext) device selection confusing for users | Medium | Low         | Auto-select first available device. Show friendly device names in picker.                   |
| Session-only storage causes data loss                             | Low    | Low         | Clear warning on exit. Export button prominently placed.                                    |

---

## Dependencies & Integrations

### External Services (User-Installed)

- **DUMP1090:** ADS-B

**Note:** Use dump1090 HTTP JSON at `/data/aircraft.json` (default port 8080). Port 30003 is the SBS text feed and requires a line parser. decoder for aircraft tracking

- Interface: JSON stream on localhost:30003 (SBS text feed)
- Version: dump1090-mutability or dump1090-fa
- **Kismet:** Wireless monitoring for drone Remote ID
  - Interface: REST API on localhost:2501
  - Version: 2022+ (with Remote ID support)
- **gpsd:** GPS daemon for location services
  - Interface: JSON stream on localhost:2947
  - Version: 3.20+
- **SoapySDR (Deferred to vNext) Server:** Unified SDR interface
  - Interface: Network socket on localhost:55132
  - Version: 0.8+

### Libraries & Frameworks

- **Electron:** Desktop application framework (v28+)
- **Node.js:** JavaScript runtime (v18 LTS)
- **MapLibre GL JS:** Map rendering (v3+)
- **better-sqlite3:** SQLite database (v9+)
- **Express or Fastify:** Backend HTTP server (v4+ / v4+)
- **WebSocket (ws):** Real-time data streaming (v8+)

---

## Appendix A: Band Plan Details

### Airband (108-137 MHz)

- **Use:** Commercial and private aircraft communications
- **Mode:** AM (Amplitude Modulation)
- **Channels:** 760 channels, 25 kHz spacing
- **Notable Frequencies:**
  - 121.5 MHz: Emergency
  - 122.8 MHz: Unicom (private aircraft)
  - 118.0-136.975 MHz: Air Traffic Control

### Marine VHF (156-162 MHz)

- **Use:** Maritime communications, Coast Guard
- **Mode:** FM (Frequency Modulation)
- **Channels:** 55+ channels, 25 kHz spacing
- **Notable Frequencies:**
  - 156.8 MHz: Channel 16 (emergency/hailing)
  - 157.1 MHz: Channel 22A (Coast Guard)

### NOAA Weather (162.4-162.55 MHz)

- **Use:** Continuous weather broadcasts, emergency alerts
- **Mode:** FM
- **Channels:** 7 channels
- **Frequencies:**
  - 162.400, 162.425, 162.450, 162.475, 162.500, 162.525, 162.550 MHz

### FRS/GMRS (462-467 MHz)

- **Use:** Family Radio Service, General Mobile Radio Service (walkie-talkies)
- **Mode:** FM (narrowband, 12.5 kHz)
- **Channels:** 22 FRS channels, 30 GMRS channels (overlap)

### CB (Citizens Band) (26.965-27.405 MHz)

- **Use:** Short-range personal/business communications
- **Mode:** AM or SSB (Single Sideband)
- **Channels:** 40 channels, 10 kHz spacing
- **Notable:** Channel 9 (emergency), Channel 19 (truckers)

### Ham 2m (144-148 MHz)

- **Use:** Amateur radio VHF band
- **Mode:** FM, SSB, CW (Morse)
- **Notable:** 146.52 MHz (national simplex calling frequency)

### Ham 70cm (420-450 MHz)

- **Use:** Amateur radio UHF band
- **Mode:** FM, SSB, digital modes
- **Notable:** 446.0 MHz (national simplex calling frequency)

---

## Appendix B: Hardware Requirements

### Minimum System Requirements

- **OS:** Ubuntu 20.04 LTS or Debian 11
- **CPU:** Intel Core i3-6100U (2015) or equivalent
- **RAM:** 4 GB
- **Disk:** 2 GB free space (10 GB with offline maps in v1.5)
- **USB:** 2x USB 2.0 ports
- **Bluetooth:** Bluetooth 4.0+ (for Remote ID)
- **Display:** 1280x720 resolution

### Recommended System Requirements

- **OS:** Ubuntu 22.04 LTS
- **CPU:** Intel Core i5-8250U (2017) or equivalent
- **RAM:** 8 GB
- **Disk:** SSD with 10 GB free space
- **USB:** 3x USB 3.0 ports
- **Bluetooth:** Bluetooth 5.0+
- **Display:** 1920x1080 resolution

### Supported SDR Hardware

- **RTL-SDR Blog v3** ($35)
  - Frequency range: 24-1766 MHz
  - Sample rate: 2.4 MS/s
  - Recommended for: Airband, Marine, NOAA, FRS/GMRS, Ham
- **RTL-SDR Blog v4** ($39.95)
  - Frequency range: 24-1766 MHz
  - Sample rate: 2.4 MS/s
  - Bias tee for antenna amplifiers
- **HackRF One** ($349)
  - Frequency range: 1 MHz-6 GHz
  - Sample rate: 20 MS/s
  - Transmit capable (disabled in app)
  - Recommended for: Wideband scanning, future features

### Supported GPS Hardware

- **DeLorme Model 9838** (SiRF Star III chipset)
- **Adafruit Ultimate GPS** (MTK3339 chipset)
- **u-blox NEO-6M** (Arduino-compatible modules)
- **Any GPS outputting NMEA via USB serial**

---

## Appendix C: Installation Guide (User-Facing)

### Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Sudo/root access
- Internet connection
- RTL-SDR or HackRF hardware
- USB GPS dongle

### Installation Steps

1. **Download the Application**

   ```bash
   git clone https://github.com/yourorg/onthego-scanner.git
   cd onthego-scanner
   ```

2. **Run Setup Script (as root)**

   ```bash
   sudo ./setup.sh
   ```

   This installs:
   - DUMP1090 (ADS-B

**Note:** Use dump1090 HTTP JSON at `/data/aircraft.json` (default port 8080). Port 30003 is the SBS text feed and requires a line parser. decoder)

- Kismet (wireless monitoring)
- SoapySDR (Deferred to vNext) + modules (RTL-SDR, HackRF)
- gpsd (GPS daemon)
- Node.js dependencies

3. **Add User to Groups**

   ```bash
   sudo usermod -aG kismet plugdev dialout $USER
   ```

   **Log out and log back in** for group changes to take effect.

4. **Start Services**

   ```bash
   sudo systemctl start dump1090
   sudo systemctl start kismet
   sudo systemctl start gpsd
   ```

5. **Launch Application**

   ```bash
   npm start
   ```

6. **Verify Device Detection**
   - Check status bar: GPS ✅ | DUMP1090 ✅ | Kismet ✅ | SDR: RTL-SDR v3 ✅
   - If any ❌ shown, see Troubleshooting section in README

### Optional: Enable Services on Boot

```bash
sudo systemctl enable dump1090
sudo systemctl enable kismet
sudo systemctl enable gpsd
```

---

## Appendix D: Data Schema (SQLite)

### Table: aircraft

```sql
CREATE TABLE aircraft (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icao TEXT UNIQUE NOT NULL,           -- ICAO 24-bit address (e.g., "A12345")
    callsign TEXT,                       -- Flight callsign (e.g., "UAL123")
    altitude INTEGER,                    -- Altitude in feet
    speed INTEGER,                       -- Ground speed in knots
    heading INTEGER,                     -- Heading in degrees (0-359)
    lat REAL,                           -- Latitude (decimal degrees)
    lon REAL,                           -- Longitude (decimal degrees)
    vertical_rate INTEGER,              -- Vertical speed in ft/min
    squawk TEXT,                        -- Transponder squawk code
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_icao (icao),
    INDEX idx_last_seen (last_seen)
);
```

### Table: drones

```sql
CREATE TABLE drones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drone_id TEXT NOT NULL,             -- Remote ID Basic ID (UA serial number)
    manufacturer TEXT,                  -- "DJI", "Autel", etc.
    model TEXT,                         -- Drone model
    drone_lat REAL,                     -- Drone latitude
    drone_lon REAL,                     -- Drone longitude
    drone_altitude REAL,                -- Drone altitude in meters MSL
    operator_lat REAL,                  -- Operator latitude (from Remote ID)
    operator_lon REAL,                  -- Operator longitude
    operator_altitude REAL,             -- Operator altitude in meters MSL
    speed REAL,                         -- Speed in m/s
    heading INTEGER,                    -- Heading in degrees
    height_agl REAL,                    -- Height above ground level in meters
    timestamp_accuracy INTEGER,         -- Timestamp accuracy (from Remote ID)
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_drone_id (drone_id),
    INDEX idx_last_seen (last_seen)
);
```

### Table: rf_signals

```sql
CREATE TABLE rf_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    frequency_mhz REAL NOT NULL,        -- Center frequency in MHz
    bandwidth_hz INTEGER,               -- Signal bandwidth in Hz
    signal_strength REAL,               -- Signal strength in dBm
    modulation TEXT,                    -- "AM", "FM", "SSB", "Digital", etc.
    band_name TEXT,                     -- "Airband", "Marine VHF", "Ham 2m", etc.
    device_lat REAL,                    -- User's location when detected
    device_lon REAL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_frequency (frequency_mhz),
    INDEX idx_band (band_name),
    INDEX idx_timestamp (timestamp)
);
```

### Table: user_settings (persistent across sessions)

```sql
CREATE TABLE user_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Example settings:
-- 'distance_unit' → 'miles' or 'km'
-- 'default_band' → 'airband'
-- 'map_zoom' → '10'
-- 'map_center_lat' → '37.7749'
-- 'map_center_lon' → '-122.4194'
```

---

## Appendix E: Success Criteria Checklist

### MVP Acceptance Criteria

#### Installation & Setup

- [ ] User completes setup.sh without errors on Ubuntu 20.04
- [ ] User completes setup.sh without errors on Debian 11
- [ ] All dependencies installed: DUMP1090, Kismet, SoapySDR (Deferred to vNext), gpsd
- [ ] README.txt provides clear installation instructions
- [ ] Setup completes in <5 minutes

#### Device Detection

- [ ] RTL-SDR v3 detected and shown in status bar
- [ ] HackRF One detected and shown in status bar
- [ ] GPS dongle (DeLorme 9838) detected via gpsd
- [ ] If multiple SDRs connected, device picker dropdown shown
- [ ] Clear error messages if devices not found

#### Aircraft Monitoring

- [ ] Aircraft from DUMP1090 displayed on map within 2 seconds
- [ ] Aircraft icons show callsign labels
- [ ] Clicking aircraft icon shows detail panel (altitude, speed, heading)
- [ ] Aircraft positions update in real-time (<2s latency)
- [ ] Aircraft list view shows all active aircraft sorted by distance

#### Drone Detection

- [ ] DJI drones broadcasting Remote ID appear on map within 2 seconds
- [ ] Drone icon distinct from aircraft icon
- [ ] Operator location extracted from Remote ID payload
- [ ] Operator shown on map with line connecting to drone
- [ ] Drone detail panel shows: ID, manufacturer, model, altitude, speed

#### Spectrum Scanning

- [ ] Band dropdown lists all 7 supported bands
- [ ] Selecting band updates waterfall frequency range
- [ ] "Start Scan" button begins spectrum visualization
- [ ] Waterfall updates at 10 Hz
- [ ] Waterfall color scale: blue → green → yellow → red
- [ ] "Stop Scan" button pauses scanning

#### Dashboard

- [ ] Dashboard shows aircraft count
- [ ] Dashboard shows drone count
- [ ] Dashboard shows RF signal count
- [ ] Statistics update in real-time
- [ ] "Active Band" dropdown functional
- [ ] "Scan" button starts/stops scanning
- [ ] "Export" button opens file picker

#### Data Management

- [ ] SQLite database created on first launch
- [ ] Session data persists during app runtime
- [ ] Export creates three CSV files with timestamped filenames
- [ ] On app exit, confirmation dialog asks about export
- [ ] Database cleared on app exit (if user confirms)

#### GPS & Location

- [ ] User location shown as blue dot on map
- [ ] GPS position updates at 1 Hz
- [ ] Distance calculations shown in aircraft/drone detail panels
- [ ] User can toggle distance unit (miles/km) in settings

#### Performance

- [ ] Map updates <2 seconds after detection
- [ ] Waterfall maintains 10 Hz frame rate
- [ ] CPU usage <50% during active scanning (Core i5-6200U)
- [ ] RAM usage <1 GB
- [ ] App starts in <10 seconds

#### UI/UX

- [ ] Map is primary view on launch
- [ ] Dashboard panel visible below map
- [ ] Waterfall collapsed by default
- [ ] All UI elements responsive to user input
- [ ] Status bar shows service/device status
- [ ] No crashes during 30-minute test session

---

## Document Revision History

| Version | Date       | Author   | Changes                                                                                                                                                                      |
| ------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2025-10-15 | Original | Initial PRD with Python/Flutter stack                                                                                                                                        |
| 2.0     | 2025-10-16 | Revised  | Complete rewrite: Electron/Node.js stack, Linux MVP, removed WiFi/BLE advertising, clarified drone Remote ID via Kismet, added detailed user stories and acceptance criteria |

---

## Approval & Sign-Off

**Product Owner:** ************\_************ Date: ****\_\_****

**Technical Lead:** ************\_************ Date: ****\_\_****

**QA Lead:** ************\_************ Date: ****\_\_****

---

**END OF PRD v2.0**

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

## Performance Targets

**Performance Targets**

- Cold start to map: < **3 s**
- Service connection: < **5 s**
- First aircraft display: < **10 s**
- Memory after 1 hour: < **800 MB** (with limits enabled)
- CPU during scanning: < **40%**
- Waterfall frame rate: **≥ 10 Hz** on capable hardware (configurable)
