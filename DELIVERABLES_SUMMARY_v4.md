# On-the-Go RF Awareness Scanner - Deliverables Summary

**Date:** October 16, 2025  
**Version:** MVP v1.0  
**Status:** Ready for Development

---

## 📦 Delivered Documents

### 1. **Product Requirements Document (PRD) v2.0**
**File:** `OnTheGo_Scanner_PRD_v2.md`

**Contents:**
- Executive Summary & Product Vision
- Target User Personas (Curious Citizen Chris, Emergency Responder Emma)
- 20+ Detailed User Stories with Acceptance Criteria
- MVP Feature Set (In/Out of Scope)
- UI Layout & User Flow Descriptions
- Non-Functional Requirements
- Success Metrics & KPIs
- Band Plan Details (7 bands)
- Hardware Requirements
- Installation Guide (user-facing)
- SQLite Database Schema
- Success Criteria Checklist

**Key Decisions:**
- Platform: Linux (Ubuntu/Debian) first
- Tech Stack: Electron + Node.js + React
- Hardware: RTL-SDR, HackRF, USB GPS
- Data Sources: DUMP1090 (aircraft), Kismet (drones), SoapySDR (spectrum)
- Storage: Session-only SQLite with CSV export
- No alerts in MVP (deferred to v2)

---

### 2. **Technical Requirements Document (TRD) v2.0**
**File:** `OnTheGo_Scanner_TRD_v2.md`

**Contents:**
- Complete System Architecture (diagrams)
- Technology Stack Details
- Component Specifications (7 major components)
  - Electron Main Process
  - Node.js Backend Server
  - DUMP1090 Client (aircraft tracking)
  - Kismet Client (drone Remote ID)
  - SDR Client (spectrum scanning)
  - GPS Client (location services)
  - React Frontend (UI components)
- External Dependency Configuration (DUMP1090, Kismet, gpsd, SoapySDR)
- Detailed API Contracts (REST + WebSocket)
- Complete Database Schema (SQLite)
- File Structure (project organization)
- Build & Deployment Instructions
- Development Environment Setup
- Testing Strategy (unit, integration, manual)
- Performance Optimization Techniques
- Security Considerations
- Appendices:
  - bandplan_us.json specification
  - Troubleshooting guide
  - Performance benchmarks

**Key Technical Decisions:**
- Backend: Fastify HTTP server + WebSocket (port 3000/3001)
- Frontend: React with MapLibre GL JS for mapping
- SDR Interface: rtl_tcp (simple) or SoapySDRServer (future)
- Drone Detection: Kismet REST API for Remote ID parsing
- Database: better-sqlite3 (synchronous, embedded)
- Build: Webpack + electron-builder

---

### 3. **Installation Script (setup.sh)**
**File:** `setup.sh` (executable)

**What It Does:**
- Detects Ubuntu/Debian OS
- Updates system packages
- Installs Node.js 18 LTS (via NodeSource)
- Installs RTL-SDR tools and drivers
- Installs SoapySDR + modules (RTL-SDR, HackRF)
- Installs HackRF tools
- Installs DUMP1090 (mutability or fa variant)
- Installs Kismet (latest from official repo)
- Installs gpsd (GPS daemon)
- Configures udev rules (non-root USB access)
- Configures user groups (kismet, dialout, plugdev)
- Creates default configuration files
- Provides post-installation instructions

**Usage:**
```bash
sudo ./setup.sh
```

**Estimated Runtime:** 5-10 minutes (depending on internet speed)

---

## 🎯 What's Been Accomplished

### ✅ Complete Requirements Definition
- All MVP features clearly scoped
- User stories with acceptance criteria
- Success metrics defined
- Out-of-scope features documented (v1.5, v2.0)

### ✅ Complete Technical Design
- System architecture designed
- Component interactions specified
- API contracts defined
- Database schema designed
- Performance targets set

### ✅ Automated Installation
- One-command setup for all dependencies
- Service configuration automated
- User permission management
- Post-install verification steps

---

## 🚀 Next Steps for Implementation

### Phase 1: Project Scaffolding (Week 1)
**Goal:** Create project structure and basic skeleton

**Tasks:**
1. Create project directory structure (see TRD File Structure)
2. Initialize npm project: `npm init`
3. Install dependencies: `npm install fastify ws better-sqlite3 ...`
4. Create empty component files with TODO comments
5. Setup Webpack configuration
6. Create basic Electron main.js and preload.js
7. Test basic Electron window launches

**Deliverables:**
- Empty project structure
- package.json with all dependencies
- Launchable (but empty) Electron window

---

### Phase 2: Backend Core (Week 2-3)
**Goal:** Implement data collection from external services

**Tasks:**
1. Implement DUMP1090 Client
   - Connect to TCP port 30003
   - Parse JSON aircraft data
   - Maintain aircraft map with stale detection
2. Implement Kismet Client
   - Connect to REST API (port 2501)
   - Poll for Bluetooth devices
   - Parse Remote ID payloads
   - Extract drone + operator locations
3. Implement GPS Client
   - Connect to gpsd (port 2947)
   - Parse TPV messages
   - Track fix status
4. Implement SDR Client (Basic)
   - Spawn rtl_tcp process
   - Connect to TCP socket
   - Receive IQ samples (defer FFT to Phase 4)
5. Implement Backend Server
   - Fastify HTTP server
   - WebSocket server
   - Health check endpoint
   - Data aggregation loop (1 Hz)
6. Implement Database Layer
   - Initialize SQLite database
   - Create tables (aircraft, drones, signals, settings)
   - Implement insert/query functions

**Testing:**
- Unit tests for each client
- Integration test: Can all clients connect to services?
- Manual test: Run backend, check WebSocket output

**Deliverables:**
- Working backend server
- Real aircraft data flowing via WebSocket
- Real drone data (if drone present)
- GPS position updates

---

### Phase 3: Frontend Core (Week 4-5)
**Goal:** Display data on map with basic UI

**Tasks:**
1. Implement App.jsx
   - WebSocket connection
   - State management (aircraft, drones, GPS)
   - Component layout
2. Implement MapView
   - MapLibre GL JS initialization
   - Aircraft marker rendering
   - Drone marker rendering
   - User location marker
   - Marker updates (add/move/remove)
   - Popup panels on click
3. Implement Dashboard
   - Statistics panels (aircraft, drones, signals)
   - Band selector dropdown
   - Scan button (non-functional yet)
   - Export button (defer to Phase 5)
4. Implement StatusBar
   - Service status indicators (DUMP1090, Kismet, GPS, SDR)
   - Health check polling
5. Basic CSS Styling
   - Layout (map full width, dashboard below)
   - Colors, fonts, spacing

**Testing:**
- Visual test: Does map display?
- Data test: Do aircraft markers appear?
- Interaction test: Can user pan/zoom map?

**Deliverables:**
- Functional map displaying real aircraft
- Dashboard showing live statistics
- Status bar showing service health

---

### Phase 4: Spectrum Scanning (Week 6-7)
**Goal:** Implement waterfall visualization and signal detection

**Tasks:**
1. Implement SDR Client (Complete)
   - Implement FFT processing (fft.js library)
   - Power spectrum calculation (dB conversion)
   - Waterfall buffer management (100 lines)
   - Signal peak detection (threshold-based)
   - Signal deduplication
2. Implement WaterfallView Component
   - Canvas rendering (10 Hz update)
   - Color mapping (blue → red)
   - Start/Stop scan controls
   - Band selection integration
3. Implement Band Selection
   - Dropdown updates backend band setting
   - Backend retunes SDR to new center frequency
   - Waterfall updates to show new band
4. Implement Signal Detection
   - Backend detects peaks in spectrum
   - Store detected signals in database
   - Include signals in WebSocket feed
   - Display signal count in dashboard

**Testing:**
- Visual test: Does waterfall display spectrum?
- Tuning test: Does band change update display?
- Signal test: Are strong signals detected?

**Deliverables:**
- Working waterfall display
- Band selection with retuning
- Signal detection and display

---

### Phase 5: Data Management & Polish (Week 8)
**Goal:** Complete MVP with export and session management

**Tasks:**
1. Implement Data Export
   - Backend: Generate CSV files (aircraft, drones, signals)
   - Frontend: File picker dialog
   - Success/error notifications
2. Implement Session Management
   - On app exit: prompt for export
   - Clear database after export (or on cancel)
   - Persistent settings (distance unit, default band)
3. Implement Detail Panels
   - Aircraft detail panel (click to show full info)
   - Drone detail panel (click to show operator location)
   - Signal detail panel (click waterfall peak)
4. UI Polish
   - Icons for aircraft, drones, user
   - Improved typography
   - Loading indicators
   - Error messages
5. Performance Optimization
   - React.memo for expensive components
   - Debounce WebSocket updates
   - Canvas rendering optimization

**Testing:**
- Export test: Can user export data to CSV?
- Session test: Does database clear on exit?
- UI test: Is interface responsive and intuitive?
- Performance test: CPU <50%, RAM <650 MB?

**Deliverables:**
- Complete MVP with all features
- Polished UI
- Data export functional
- Session management working

---

### Phase 6: Testing & Documentation (Week 9-10)
**Goal:** Ensure quality and prepare for release

**Tasks:**
1. Write Automated Tests
   - Backend unit tests (Jest)
   - Frontend component tests (React Testing Library)
   - Integration tests (WebSocket, database)
2. Manual Testing
   - Complete QA checklist (see PRD Appendix E)
   - Test on clean Ubuntu 20.04 VM
   - Test on Debian 11 VM
   - Test with RTL-SDR device
   - Test with HackRF device
   - Test with GPS dongle
   - 30-minute stress test (memory leaks, crashes)
3. Write User Documentation
   - USER_GUIDE.md (how to use the app)
   - TROUBLESHOOTING.md (common issues)
   - FAQ.md (frequently asked questions)
4. Code Cleanup
   - Remove console.log statements
   - Add JSDoc comments
   - Run ESLint and fix issues
   - Optimize bundle size
5. Create Production Build
   - Run electron-builder
   - Test .deb package installation
   - Test AppImage execution

**Testing:**
- Install test: Can user install from .deb?
- Launch test: Does app start without errors?
- Feature test: Do all MVP features work?
- Crash test: Does app handle errors gracefully?

**Deliverables:**
- Test coverage >70%
- Complete user documentation
- Clean, production-ready code
- Installable .deb and AppImage files

---

## 📋 Implementation Checklist

### Pre-Development
- [ ] Review PRD and TRD thoroughly
- [ ] Set up development machine (Ubuntu/Debian)
- [ ] Run setup.sh to install dependencies
- [ ] Verify all services running (DUMP1090, Kismet, gpsd)
- [ ] Test SDR and GPS hardware

### Development Milestones
- [ ] Phase 1: Project scaffolding (Week 1)
- [ ] Phase 2: Backend core (Week 2-3)
- [ ] Phase 3: Frontend core (Week 4-5)
- [ ] Phase 4: Spectrum scanning (Week 6-7)
- [ ] Phase 5: Data management & polish (Week 8)
- [ ] Phase 6: Testing & documentation (Week 9-10)

### Pre-Release
- [ ] All acceptance criteria met (PRD Appendix E)
- [ ] Performance targets achieved (TRD Appendix D)
- [ ] User documentation complete
- [ ] Production build tested
- [ ] Installation tested on clean VM

---

## 🛠️ Development Tools & Resources

### Required Hardware (for Testing)
- **RTL-SDR v3 or v4** ($35-40)
  - For airband, marine, NOAA, FRS/GMRS, Ham bands
  - Available: RTL-SDR Blog, Amazon, etc.
- **HackRF One** ($349) (optional for MVP, recommended for v2)
  - For wideband scanning, future features
- **USB GPS Dongle** ($20-50)
  - DeLorme Model 9838 (confirmed working)
  - Adafruit Ultimate GPS
  - u-blox NEO-6M modules

### Recommended Development Environment
- **OS:** Ubuntu 22.04 LTS (or Debian 11)
- **IDE:** Visual Studio Code
  - Extensions: ESLint, Prettier, React DevTools
- **Terminal:** GNOME Terminal or Terminator (multi-pane)
- **Browser:** Chrome/Chromium (for DevTools)
- **Version Control:** Git + GitHub

### Useful Commands
```bash
# Start services
sudo systemctl start dump1090-mutability
kismet --daemonize --silent
sudo systemctl start gpsd

# Check service status
sudo systemctl status dump1090-mutability
ps aux | grep kismet
sudo systemctl status gpsd

# Test hardware
rtl_test -t                    # Test RTL-SDR
hackrf_info                    # Test HackRF
gpspipe -w -n 5                # Test GPS
SoapySDRUtil --find            # List SDR devices

# Development
npm run backend                # Start backend server
npm run frontend               # Start webpack dev server
npm run electron:dev           # Start Electron app
npm test                       # Run tests
npm run build                  # Production build
```

---

## 📊 Estimated Effort

| Phase | Duration | Complexity | Key Risks |
|-------|----------|------------|-----------|
| 1. Scaffolding | 1 week | Low | None |
| 2. Backend Core | 2 weeks | Medium | Kismet Remote ID parsing |
| 3. Frontend Core | 2 weeks | Medium | MapLibre performance |
| 4. Spectrum Scanning | 2 weeks | High | FFT performance, signal detection |
| 5. Data Management | 1 week | Low | None |
| 6. Testing & Docs | 2 weeks | Medium | Cross-platform issues |
| **Total** | **10 weeks** | | |

**Assumes:** 1 full-time developer with:
- Strong JavaScript/Node.js skills
- React experience
- Basic understanding of SDR concepts
- Familiarity with Linux system administration

**For a team of 2 developers:** 6-8 weeks

---

## 🎓 Learning Resources

### SDR Fundamentals
- **RTL-SDR Blog:** https://www.rtl-sdr.com/
- **RTL-SDR Quick Start Guide:** https://www.rtl-sdr.com/rtl-sdr-quick-start-guide/
- **Great Scott Gadgets SDR Tutorial:** https://greatscottgadgets.com/sdr/

### Technologies
- **Electron Documentation:** https://www.electronjs.org/docs
- **React Documentation:** https://react.dev/
- **MapLibre GL JS:** https://maplibre.org/maplibre-gl-js-docs/
- **Fastify Documentation:** https://www.fastify.io/docs/
- **better-sqlite3:** https://github.com/WiseLibs/better-sqlite3

### External Tools
- **DUMP1090 Documentation:** https://github.com/antirez/dump1090
- **Kismet Documentation:** https://www.kismetwireless.net/docs/
- **SoapySDR Wiki:** https://github.com/pothosware/SoapySDR/wiki
- **gpsd Documentation:** https://gpsd.gitlab.io/gpsd/

### Remote ID Standards
- **ASTM F3411 Standard:** Remote ID specification
- **FAA Remote ID Rule:** https://www.faa.gov/uas/getting_started/remote_id

---

## 📞 Support & Feedback

### During Development
- **Technical Questions:** Refer to TRD Appendix C (Troubleshooting)
- **Feature Clarifications:** Refer to PRD User Stories
- **Design Decisions:** Document in `docs/ARCHITECTURE_DECISIONS.md`

### Post-MVP
- **Issue Tracking:** Use GitHub Issues
- **User Feedback:** Create `docs/FEEDBACK.md`
- **Version Planning:** See PRD Out of Scope (v1.5, v2.0)

---

## 🎉 Success Criteria

MVP is considered **successful** when:

### Functional Criteria
- ✅ User can plug in RTL-SDR and see aircraft on map
- ✅ User can detect drones broadcasting Remote ID
- ✅ User can scan a frequency band and see waterfall
- ✅ User can export session data to CSV
- ✅ All services (DUMP1090, Kismet, gpsd) integrate correctly

### Quality Criteria
- ✅ No crashes during 30-minute session
- ✅ CPU usage <50% during active scanning
- ✅ Memory usage <650 MB
- ✅ Map updates <2 seconds latency
- ✅ Waterfall maintains 10 Hz frame rate

### User Experience Criteria
- ✅ Installation completes in <10 minutes
- ✅ New user sees aircraft within 5 minutes of first launch
- ✅ All UI controls are intuitive (no documentation required for basic use)
- ✅ Error messages are clear and actionable

---

## 📝 Version Roadmap

### v1.0 (Current MVP) - Linux
- RTL-SDR + HackRF support
- Aircraft tracking (DUMP1090)
- Drone detection (Kismet Remote ID)
- Spectrum scanning (basic)
- Map visualization
- Session-only data storage

### v1.5 - Windows Port
- Windows .exe installer
- Bundled dependencies
- Windows-specific driver handling
- Same features as v1.0

### v2.0 - Advanced Features
- Alert system (proximity, emergency frequencies)
- Custom CSV frequency import
- RadioReference integration
- WiFi wardriving
- BLE advertising collection
- ESP32/NRF5340 integration
- Direction-of-arrival (DOA) for drones
- Audio demodulation (listen to signals)
- Additional SDR support (USRP, Airspy)
- Mobile app (Android/iOS)

---

## 🏁 Final Notes

This project provides a **complete blueprint** for building a user-friendly RF awareness application. The PRD defines **what** to build, the TRD specifies **how** to build it, and the setup script provides the **foundation** for development.

**Key Success Factors:**
1. **Follow the PRD user stories** - they define success
2. **Use the TRD component specs** - they're battle-tested patterns
3. **Test incrementally** - don't wait until Phase 6
4. **Start simple, iterate** - MVP first, polish later
5. **Document decisions** - future you will thank you

**Remember:** The goal is to make RF monitoring accessible to **everyone**, not just radio experts. Keep the interface simple, the features focused, and the user experience smooth.

Good luck! 🚀

---

**Delivered Files:**
1. `OnTheGo_Scanner_PRD_v2.md` (50+ pages)
2. `OnTheGo_Scanner_TRD_v2.md` (60+ pages)
3. `setup.sh` (executable installation script)
4. `DELIVERABLES_SUMMARY.md` (this document)

**Total Documentation:** 120+ pages of comprehensive requirements and technical specifications.


## Update Checklist (v3)
- ✅ Standardize SDR transport on `rtl_tcp:1234` for MVP; defer SoapySDR to vNext.
- ✅ ADS-B input via dump1090 HTTP JSON (`/data/aircraft.json`, :8080); SBS:30003 optional with parser.
- ✅ Kismet Remote ID: feature-detect; fallback raw BLE or `opendroneid-core-c`; operator location optional.
- ✅ FFT moved to Web Worker; configurable fftSize/rate; binary frames for efficiency.
- ✅ Security: gpsd without `-G`; Kismet bind to localhost; Electron CSP and hardened flags.
- ✅ Robust WebSocket reconnection with exponential backoff + jitter.
- ✅ Exit cleanup hooks: stop scans, close sockets, purge temp DB if promised.
- ✅ Dependency matrix and graceful-degradation modes documented.
- ✅ Memory target adjusted (~1 GB) + performance mode.
- ✅ Tests: mock feeds, integration harness, initial CI skeleton.
- ✅ Band-plan caveats and ASTM F3411-22a coverage documented.


## Update Checklist (v4)
- ✅ Input validation & resource limits documented and enforced
- ✅ DUMP1090 HTTP JSON polling standardized at 1 Hz
- ✅ FFT moved to Worker, circular-buffer waterfall; ≥10 Hz target on capable hardware
- ✅ GPS manual fallback added to UX
- ✅ Progressive loading and friendly error recovery patterns adopted
- ✅ WebSocket reconnection with backoff + jitter
- ✅ Database batching (100-record groups, 5s flush) policy
- ✅ Mock Mode with USE_MOCK_DATA; dev test scripts planned
- ✅ Testing checklist expanded to cover edge cases & soak tests
- ✅ Performance targets updated (map <3s, first aircraft <10s, memory <800MB)
