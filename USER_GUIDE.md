# OnTheGo Scanner - User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Interface Overview](#user-interface-overview)
4. [Features](#features)
5. [Settings](#settings)
6. [RF Scanner](#rf-scanner)
7. [Data Export](#data-export)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

**OnTheGo Scanner** is a real-time RF spectrum analyzer and aircraft/drone tracking application. It combines:

- **ADS-B Aircraft Tracking** - See aircraft positions, altitudes, speeds, and callsigns
- **Drone Detection** - Monitor Remote ID broadcasts from nearby drones
- **RF Spectrum Analysis** - Real-time waterfall and spectrum analyzer
- **GPS Integration** - Display your position and calculate distances
- **Live Map** - Interactive map showing aircraft, drones, and your location

---

## Getting Started

### First Launch

1. **Launch the application**
   - Double-click the AppImage file (Linux)
   - Or run `npm run dev` from the project directory

2. **Initial Setup**
   - The app will open with default settings
   - Map centers on NYC by default (configurable in Settings)
   - All service connections start automatically

3. **Connection Status**
   - Check the top bar for service status indicators
   - Green = Connected, Red = Disconnected
   - Services: RTL-TCP, dump1090, Kismet, GPS

### Hardware Requirements

For full functionality, you need:

- **RTL-SDR Dongle** - For RF scanning and aircraft reception
- **GPS Receiver** (optional) - For accurate position tracking
- **WiFi Adapter** - For drone Remote ID detection (via Kismet)

### Without Hardware (Demo Mode)

To test without hardware:
```bash
USE_MOCK_DATA=true npm run dev
```

This enables mock data for all services, showing simulated aircraft and drones.

---

## User Interface Overview

### Main Layout

```
┌─────────────────────────────────────────────────┐
│  Top Bar: Status | Settings | Export            │
├──────────────┬──────────────────────────────────┤
│              │                                   │
│  Side Panel  │         Map Panel                │
│              │                                   │
│  - Dashboard │  (Aircraft, Drones, Your Location)│
│  - Aircraft  │                                   │
│  - Drones    │                                   │
│  - RF Scan   │                                   │
│              │                                   │
└──────────────┴──────────────────────────────────┘
```

### Top Bar

- **Status Indicators** - Shows connection status for all services
- **Settings Button** - Opens settings panel
- **Export Button** - Export data to CSV/JSON

### Side Panel Tabs

#### 1. Dashboard
- Overview of all detected objects
- Connection status summary
- Quick statistics

#### 2. Aircraft
- List of all detected aircraft
- Click any aircraft to see details
- Sorted by distance (nearest first)
- Shows: Callsign, altitude, speed, distance

#### 3. Drones
- List of detected drones with Remote ID
- Click any drone to see details
- Shows: Drone ID, operator location, altitude

#### 4. RF Scan
- Live RF spectrum analyzer
- Waterfall display
- Frequency controls
- Band presets (Airband, Marine, GMRS, FRS, 2m Amateur, 70cm Amateur)

### Map Panel

- **Aircraft Markers** - Blue airplane icons
- **Drone Markers** - Red drone icons
- **Your Position** - Green marker (when GPS connected)
- **Click any marker** to see detailed information
- **Pan/Zoom** - Standard map controls

---

## Features

### Aircraft Tracking

**What You See:**
- Real-time aircraft positions on the map
- Flight path trails
- Altitude, speed, heading
- Callsign or flight number
- Distance from your position

**Aircraft Detail Panel:**
- Full aircraft information
- ICAO hex code
- Vertical rate (climb/descent)
- Last seen timestamp
- Signal strength

### Drone Detection

**What You See:**
- Drones broadcasting Remote ID
- Drone position and altitude
- Operator location (if available)
- Drone manufacturer and model

**Drone Detail Panel:**
- Drone ID
- Manufacturer and model
- Current position and altitude
- Operator position (if transmitted)
- Speed and heading
- Last seen timestamp

### Distance Calculations

- All distances calculated from your position
- Choose units: Miles, Kilometers, or Nautical Miles
- Updates automatically as aircraft/drones move

---

## Settings

Click the **Settings** button in the top bar to open the settings panel.

### Services Tab

**Configure service endpoints:**

- **Backend Host/Port** - Backend server connection (default: 127.0.0.1:3000)
- **dump1090 Host/Port** - ADS-B decoder (default: 127.0.0.1:8080)
- **Kismet Host/Port** - Remote ID capture (default: 127.0.0.1:2501)
- **RTL-TCP Host/Port** - SDR server (default: 127.0.0.1:1234)
- **GPSD Host/Port** - GPS daemon (default: 127.0.0.1:2947)

**Test Connection:**
- Click "Test Connection" for any service to verify it's reachable
- Green checkmark = Success
- Red X = Failed (check that service is running)

### Preferences Tab

**Distance Unit:**
- Miles (default)
- Kilometers
- Nautical Miles

**Map Style:**
- DemoTiles (default)
- OpenStreetMap
- Dark
- Satellite

**Map Default Center:**
- Set default map center coordinates
- Latitude (e.g., 40.7306 for NYC)
- Longitude (e.g., -73.9352 for NYC)

**Map Default Zoom:**
- Set default zoom level (0-20)
- Higher = more zoomed in

### Notifications Tab

**Enable/Disable Notifications:**
- Master notifications toggle

**Notification Types:**
- **Drone Detected** - Alert when new drone appears
- **Aircraft Proximity** - Alert when aircraft comes within threshold
- **Signal Status** - Alert on service connection changes

**Aircraft Proximity Threshold:**
- Set distance for proximity alerts (in selected distance unit)

### Performance Tab

**Peak Detection Sensitivity:**
- **Low** - Fewer peaks, higher threshold (less sensitive)
- **Medium** - Balanced (default)
- **High** - More peaks, lower threshold (more sensitive)
- Changes apply immediately (no restart required)

**Waterfall Max Rows:**
- Number of rows in waterfall display
- Lower = less memory, faster
- Higher = longer history
- Range: 50-500 (default: 100)

**Max Aircraft to Display:**
- Limit number of aircraft shown
- Prevents clutter with many aircraft
- Default: 100

**Telemetry Update Interval:**
- How often data updates (in milliseconds)
- Lower = more frequent updates, higher CPU
- Higher = less frequent, lower CPU
- Default: 1000ms (1 second)

### Reset to Defaults

Click **Reset to Defaults** to restore all settings to factory defaults.

---

## RF Scanner

### Band Presets

Choose from predefined frequency bands:

- **Airband** - 127.5 MHz (118-137 MHz aviation band)
- **Marine** - 156.8 MHz (maritime VHF)
- **GMRS** - 462.625 MHz (General Mobile Radio Service)
- **FRS** - 467.5625 MHz (Family Radio Service)
- **2m Amateur** - 146 MHz (2-meter ham band)
- **70cm Amateur** - 435 MHz (70-centimeter ham band)

### Manual Tuning

**Center Frequency (MHz):**
- Set the center frequency for scanning
- Example: 127.500 for airband

**Span (MHz):**
- How wide the spectrum window is
- Example: 2.048 MHz shows ±1.024 MHz from center

**Sample Rate (MHz):**
- SDR sample rate
- Must match or exceed span
- Example: 2.048 MHz

**Gain:**
- RF gain setting
- Auto (recommended) or manual (0-40 dB)

### Start/Stop Scanning

1. **Select a band preset** or enter custom frequencies
2. **Click Start** to begin scanning
3. **View the spectrum analyzer** - Shows signal strength vs. frequency
4. **View the waterfall** - Scrolling history of spectrum data
5. **Click Stop** to stop scanning

### Understanding the Display

**Spectrum Analyzer (Top):**
- X-axis: Frequency
- Y-axis: Power (dB)
- Peaks indicate strong signals

**Waterfall (Bottom):**
- X-axis: Frequency
- Y-axis: Time (newest at top)
- Color: Signal strength (blue=weak, red=strong)

### Export RF Data

Click **Export CSV** to save detected signals:
- Timestamp
- Frequency
- Power level
- Bandwidth

---

## Data Export

Click the **Export** button in the top bar to export data.

### Available Exports

**Aircraft Data:**
- All detected aircraft
- Includes: position, altitude, speed, callsign, ICAO
- Formats: CSV, JSON

**Drone Data:**
- All detected drones
- Includes: Remote ID, position, altitude, operator location
- Formats: CSV, JSON

**Signal Data:**
- RF spectrum peaks
- Includes: frequency, power, timestamp
- Formats: CSV, JSON

### Export Options

1. **Select Table** - Aircraft, Drones, or Signals
2. **Select Format** - CSV or JSON
3. **Choose Time Range:**
   - All data
   - Last hour
   - Custom range (specify start/end timestamps)
4. **Click Export**
5. File downloads automatically

---

## Troubleshooting

### No Aircraft Showing

**Possible Causes:**
- RTL-SDR not connected or not recognized
- dump1090 not running
- No aircraft in range
- Antenna not connected

**Solutions:**
1. Check RTL-SDR is plugged in: `lsusb | grep Realtek`
2. Test RTL-SDR: `rtl_test -t`
3. Start dump1090:
   ```bash
   dump1090 --net --quiet
   ```
4. Check dump1090 web interface: http://127.0.0.1:8080
5. Verify antenna is connected
6. Try outdoor location or near window

### No Drones Showing

**Possible Causes:**
- Kismet not running
- No drones in range broadcasting Remote ID
- WiFi adapter in wrong mode

**Solutions:**
1. Start Kismet:
   ```bash
   sudo kismet -c wlan0
   ```
2. Check Kismet web interface: http://127.0.0.1:2501
3. Verify Remote ID capture is enabled in Kismet
4. Wait - Remote ID has limited range (~1km)

### GPS Not Working

**Possible Causes:**
- gpsd not running
- GPS receiver not connected
- No GPS fix (indoors, poor sky view)

**Solutions:**
1. Check GPS device: `ls /dev/ttyUSB* /dev/ttyACM*`
2. Test GPS: `cgps -s` or `gpsmon`
3. Start gpsd:
   ```bash
   sudo systemctl start gpsd
   ```
4. Move to location with clear sky view
5. Wait for GPS fix (can take 1-2 minutes)

### Waterfall Blank

**Possible Causes:**
- RTL-TCP not running
- Scan not started
- No RF signal in selected band

**Solutions:**
1. Start rtl_tcp:
   ```bash
   rtl_tcp -a 127.0.0.1 -p 1234
   ```
2. Click **Start** in RF Scan tab
3. Try different frequency band
4. Check antenna connection
5. Increase gain setting

### App Won't Start

**Possible Causes:**
- Port already in use
- Missing dependencies
- Permission issues

**Solutions:**
1. Kill existing process:
   ```bash
   killall node
   killall electron
   ```
2. Reinstall dependencies:
   ```bash
   rm -rf node_modules
   npm install
   ```
3. Check for errors in terminal output
4. Try running with sudo (not recommended, but may help diagnose)

### Map Not Loading

**Possible Causes:**
- No internet connection (for map tiles)
- Map style server unavailable

**Solutions:**
1. Check internet connection
2. Try different map style in Settings → Preferences
3. Wait and retry - tile servers can be temporarily down
4. Use offline map style if available

### Settings Not Saving

**Possible Causes:**
- Database permission issues
- Disk full

**Solutions:**
1. Check disk space: `df -h`
2. Check data directory permissions:
   ```bash
   ls -la data/
   ```
3. Manually delete settings database:
   ```bash
   rm data/settings.sqlite
   ```
4. Restart app (creates new database)

---

## Keyboard Shortcuts

(To be implemented)

- `Ctrl+S` - Open Settings
- `Ctrl+E` - Open Export
- `Ctrl+R` - Refresh/Reconnect services
- `Escape` - Close dialogs

---

## Tips & Best Practices

### Antenna Placement

- **Aircraft (ADS-B):** Outdoor antenna on roof, clear view of sky
- **Drones (Remote ID):** WiFi antenna, near window or outdoors
- **Optimal height:** Higher is better, reduces ground obstacles

### Performance

- **Reduce max aircraft** if app is slow
- **Lower telemetry update interval** if CPU is high
- **Decrease waterfall rows** to reduce memory usage

### Accuracy

- **GPS required** for accurate distance calculations
- **Without GPS** - uses default position (NYC) or manual setting
- **Altitude affects range** - higher altitude = longer range

### Privacy

- All data stays on your local machine
- No data sent to external servers
- Export files contain your GPS position (if enabled)

---

## FAQ

**Q: Do I need an internet connection?**
A: Only for map tiles. All tracking works offline.

**Q: What RTL-SDR dongles are supported?**
A: Any RTL2832U-based dongle. Popular: RTL-SDR Blog V3, NooElec NESDR.

**Q: How far can I detect aircraft?**
A: Typically 100-250 miles with good antenna at elevation. Limited by line-of-sight.

**Q: How far can I detect drones?**
A: Remote ID range is limited to ~1km by design.

**Q: Can I track military aircraft?**
A: Some military aircraft broadcast ADS-B, many do not.

**Q: Is this legal?**
A: Yes. Receiving ADS-B and Remote ID broadcasts is legal worldwide.

**Q: Can I run this on Windows/Mac?**
A: Currently Linux only. Windows/Mac support planned.

**Q: How much CPU/RAM does it use?**
A: Typically <10% CPU, <500MB RAM on modern systems.

---

## Getting Help

- **GitHub Issues:** Report bugs and request features
- **Documentation:** Check DEVELOPMENT.md for technical details
- **Logs:** Check terminal output for error messages

---

## Glossary

- **ADS-B** - Automatic Dependent Surveillance-Broadcast (aircraft tracking)
- **ICAO** - International Civil Aviation Organization (aircraft identifier)
- **Remote ID** - Drone identification broadcast standard
- **RTL-SDR** - Software Defined Radio based on RTL2832U chip
- **dump1090** - Popular ADS-B decoder software
- **Kismet** - Wireless network detector and packet analyzer
- **gpsd** - GPS daemon that interfaces with GPS receivers
- **Waterfall** - Scrolling frequency vs. time visualization
- **MHz** - Megahertz (million cycles per second)
- **dB** - Decibel (logarithmic power measurement)
