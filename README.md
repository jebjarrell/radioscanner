# OnTheGo Scanner

**Real-time aircraft tracking, drone detection, and RF spectrum analysis in one application.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-lightgrey.svg)
![Version](https://img.shields.io/badge/version-0.1.0-green.svg)

---

## Features

### 🛩️ Aircraft Tracking (ADS-B)
- Real-time aircraft positions on interactive map
- Flight details: callsign, altitude, speed, heading
- Distance calculations from your position
- Historical tracking and data export

### 🚁 Drone Detection (Remote ID)
- Detect drones broadcasting Remote ID
- Drone and operator positions
- Manufacturer and model information
- Compliance monitoring

### 📡 RF Spectrum Analysis
- Live waterfall display
- Spectrum analyzer with peak detection
- Multiple band presets (Airband, Marine, GMRS, FRS, Amateur Radio)
- Configurable sensitivity and scan parameters

### 🗺️ Interactive Mapping
- Multiple map styles (OSM, Satellite, Dark mode)
- GPS integration for your position
- Distance and bearing calculations
- Pan/zoom controls

### ⚙️ Powerful Settings
- Configurable service endpoints
- Distance units (miles, km, nautical miles)
- Performance tuning (sensitivity, update rates)
- Notification preferences
- Data export (CSV/JSON)

---

## Windows Support

OnTheGo Scanner now supports Windows 10/11 with some limitations.

### Feature Comparison

| Feature | Linux | Windows |
|---------|-------|---------|
| UI/UX | ✅ Full | ✅ Full |
| Mock Data Mode | ✅ Full | ✅ Full |
| Database & Settings | ✅ Full | ✅ Full |
| RTL-SDR (RF Spectrum) | ✅ Full | ✅ Full* |
| Bluetooth Remote ID | ✅ Full | ⚠️ Requires Driver Setup |
| ADS-B (dump1090) | ✅ Native | ❌ Alternative Required |
| Wi-Fi Remote ID (Kismet) | ✅ Full | ⚠️ Experimental |
| GPS (gpsd) | ✅ Full | ❌ Not Available |

*Requires RTL-SDR drivers and Zadig WinUSB setup

**Windows Installation:**
- Download Windows installer from [Releases](https://github.com/yourusername/radioscanner/releases)
- See [WINDOWS_SETUP.md](WINDOWS_SETUP.md) for complete setup guide
- Developers: See [WINDOWS_BUILD.md](WINDOWS_BUILD.md) for building from source

**Recommended for Windows users:** Run in **Mock Data Mode** for full UI experience without hardware setup.

---

## Quick Start

### For Users

**1. Installation**

**Linux:**
Download the latest AppImage from [Releases](https://github.com/yourusername/radioscanner/releases):

```bash
chmod +x onthego-scanner-*.AppImage
./onthego-scanner-*.AppImage
```

**Windows:**
Download the Windows installer and see [WINDOWS_SETUP.md](WINDOWS_SETUP.md):

```powershell
# Run the installer
.\onthego-scanner-X.X.X-x64-setup.exe
```

**2. Hardware Setup (Optional)**

For full functionality:
- **RTL-SDR dongle** - Aircraft reception and RF scanning
- **GPS receiver** - Accurate position tracking
- **WiFi adapter** - Drone Remote ID detection

**3. Run with Mock Data (No Hardware)**

Test without hardware using simulated data:

```bash
USE_MOCK_DATA=true ./onthego-scanner-*.AppImage
```

**📖 Full User Guide:** See [USER_GUIDE.md](USER_GUIDE.md) for detailed instructions

---

### For Developers

**1. Setup**

```bash
git clone https://github.com/yourusername/radioscanner.git
cd radioscanner
npm install
```

**2. Development Mode**

```bash
# With mock data (no hardware needed)
USE_MOCK_DATA=true npm run dev

# With real hardware
npm run dev
```

**3. Build**

```bash
# Linux
npm run build:linux
# Output: dist/onthego-scanner-*.AppImage

# Windows
npm run build:win
# Output: dist/onthego-scanner-*-setup.exe

# All platforms
npm run build:all
```

**📖 Development Guides:**
- [DEVELOPMENT.md](DEVELOPMENT.md) - Architecture and API docs
- [WINDOWS_BUILD.md](WINDOWS_BUILD.md) - Building for Windows

---

## Documentation

| Document | Description |
|----------|-------------|
| **[USER_GUIDE.md](USER_GUIDE.md)** | Complete user manual with setup, features, and troubleshooting |
| **[WINDOWS_SETUP.md](WINDOWS_SETUP.md)** | Windows installation and setup guide |
| **[DEVELOPMENT.md](DEVELOPMENT.md)** | Architecture, API reference, and development workflow |
| **[WINDOWS_BUILD.md](WINDOWS_BUILD.md)** | Building for Windows (developers) |
| **[OnTheGo_Scanner_PRD_v4.md](OnTheGo_Scanner_PRD_v4.md)** | Product requirements and specifications |
| **[OnTheGo_Scanner_TRD_v4.md](OnTheGo_Scanner_TRD_v4.md)** | Technical design and implementation details |

---

## Requirements

### System Requirements

- **OS:**
  - Linux (Ubuntu 20.04+ recommended) - Full feature support
  - Windows 10/11 (64-bit) - Limited feature support
- **Node.js:** 18.17.0+ (for development)
- **RAM:** 4GB minimum, 8GB recommended
- **CPU:** Multi-core processor recommended

### Hardware Requirements (Optional)

- **RTL-SDR Dongle:** Any RTL2832U-based device
- **GPS Receiver:** USB GPS with gpsd support
- **WiFi Adapter:** For Kismet drone detection

### Software Dependencies

For full functionality, install these services:

```bash
# RTL-SDR tools
sudo apt install rtl-sdr

# ADS-B decoder
sudo apt install dump1090-mutability

# Drone detection
sudo apt install kismet

# GPS daemon
sudo apt install gpsd gpsd-clients
```

---

## Architecture

### Services Overview

```
┌─────────────────────────────────────────────┐
│            OnTheGo Scanner App              │
│  ┌─────────────────────────────────────┐   │
│  │     Frontend (React + MapLibre)     │   │
│  └────────────────┬────────────────────┘   │
│                   │ WebSocket                │
│  ┌────────────────▼────────────────────┐   │
│  │    Backend (Node.js + Fastify)      │   │
│  └────────────────┬────────────────────┘   │
└───────────────────┼─────────────────────────┘
                    │
       ┌────────────┼────────────┐
       │            │            │
┌──────▼─────┐ ┌───▼────┐ ┌────▼────┐ ┌────▼────┐
│  RTL-TCP   │ │dump1090│ │ Kismet  │ │  gpsd   │
│  (RF Data) │ │(ADS-B) │ │(RemoteID)│ │  (GPS)  │
└────────────┘ └────────┘ └─────────┘ └─────────┘
```

### Data Flow

1. **External services** provide raw data streams
2. **Backend** processes and aggregates data
3. **WebSocket** streams consolidated telemetry to frontend
4. **React components** render real-time visualization
5. **User actions** trigger backend API calls

---

## Configuration

### Default Service Endpoints

| Service | Default Endpoint | Configurable |
|---------|------------------|--------------|
| Backend Server | `127.0.0.1:3000` | ✅ via Settings |
| RTL-TCP | `127.0.0.1:1234` | ✅ via Settings |
| dump1090 | `127.0.0.1:8080` | ✅ via Settings |
| Kismet | `127.0.0.1:2501` | ✅ via Settings |
| gpsd | `127.0.0.1:2947` | ✅ via Settings |

All endpoints can be changed in the Settings panel without code changes.

### Environment Variables

```bash
# Enable mock data (no hardware required)
USE_MOCK_DATA=true

# Custom backend port
BACKEND_PORT=3001

# Custom settings database location
SETTINGS_DB_FILE=/path/to/settings.sqlite

# Custom session database location
SESSION_DB_FILE=/path/to/session.sqlite
```

---

## Scripts

### User Scripts

```bash
# Run the application (from source)
npm start

# Run with mock data
USE_MOCK_DATA=true npm start
```

### Development Scripts

```bash
# Development mode with hot reload
npm run dev

# Backend only
npm run backend

# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests
npm test

# Build production package
npm run build
```

### Diagnostic Scripts

```bash
# Check service connectivity
npm run doctor

# Run mock mode (standalone)
npm run mock

# Performance/load test
npm run perf
```

---

## Troubleshooting

### Common Issues

**No aircraft showing:**
- Verify RTL-SDR is connected: `lsusb | grep Realtek`
- Check dump1090 is running: `curl http://127.0.0.1:8080/data/aircraft.json`
- Ensure antenna is connected and has clear sky view

**GPS not working:**
- Check GPS device: `ls /dev/ttyUSB* /dev/ttyACM*`
- Test with: `cgps -s`
- Verify gpsd is running: `systemctl status gpsd`

**Waterfall blank:**
- Start rtl_tcp: `rtl_tcp -a 127.0.0.1 -p 1234`
- Click "Start" button in RF Scan tab
- Check antenna connection

**Port already in use:**
```bash
# Kill existing processes
killall node electron

# Or change port
BACKEND_PORT=3001 npm run dev
```

**For detailed troubleshooting:** See [USER_GUIDE.md - Troubleshooting](USER_GUIDE.md#troubleshooting)

---

## FAQ

**Q: Do I need special hardware?**
A: No! Run with `USE_MOCK_DATA=true` to try the app with simulated data.

**Q: What operating systems are supported?**
A: Currently Linux only. Windows/Mac support is planned.

**Q: Is this legal?**
A: Yes. Receiving ADS-B and Remote ID broadcasts is legal worldwide.

**Q: How far can I track aircraft?**
A: Typically 100-250 miles with a good antenna at elevation (line-of-sight).

**Q: How far can I detect drones?**
A: Remote ID is limited to ~1km by design.

**Q: Can I contribute?**
A: Yes! See [DEVELOPMENT.md - Contributing](DEVELOPMENT.md#contributing)

---

## Contributing

We welcome contributions! Please see [DEVELOPMENT.md](DEVELOPMENT.md) for:

- Setting up development environment
- Code style guidelines
- Testing requirements
- Pull request process

---

## Recent Updates

### Version 0.1.0 (Latest)

**New Features:**
- ✅ GPS position frontend integration
- ✅ Dynamic peak detection sensitivity (no restart required)
- ✅ Waterfall max rows setting integration
- ✅ Enhanced RF band options (2m/70cm Amateur bands)
- ✅ Frequency display in MHz (simplified UI)

**Bug Fixes:**
- Fixed RTL-TCP buffer memory leak
- Fixed MapPanel cleanup race conditions
- Resolved settings integration issues
- Code cleanup and linting fixes

**For full changelog:** See commit history

---

## Roadmap

### Planned Features

- [ ] **Multi-platform support** - Windows and macOS
- [ ] **Mobile app** - Android/iOS companion
- [ ] **Advanced filtering** - Filter aircraft by type, altitude, etc.
- [ ] **Recording mode** - Save sessions for replay
- [ ] **Plugin system** - Extend functionality
- [ ] **Dark theme** - System-wide dark mode
- [ ] **Alerts** - Customizable alert conditions

---

## Support

- **Issues:** Report bugs and request features on [GitHub Issues](https://github.com/yourusername/radioscanner/issues)
- **Documentation:** Check [USER_GUIDE.md](USER_GUIDE.md) and [DEVELOPMENT.md](DEVELOPMENT.md)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Credits

### Technologies

- [Electron](https://www.electronjs.org/) - Desktop framework
- [React](https://react.dev/) - UI library
- [Vite](https://vitejs.dev/) - Build tool
- [Fastify](https://fastify.dev/) - Backend framework
- [MapLibre GL](https://maplibre.org/) - Mapping library
- [TypeScript](https://www.typescriptlang.org/) - Type safety

### Data Sources

- [dump1090](https://github.com/antirez/dump1090) - ADS-B decoding
- [Kismet](https://www.kismetwireless.net/) - Wireless monitoring
- [RTL-SDR](https://www.rtl-sdr.com/) - Software defined radio
- [gpsd](https://gpsd.gitlab.io/gpsd/) - GPS daemon

### Inspiration

Built for radio enthusiasts, aviation fans, and drone safety professionals.

---

**Made with ❤️ for the aviation and RF community**
