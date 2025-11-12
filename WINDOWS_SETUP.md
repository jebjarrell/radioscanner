# Windows Setup Guide

Complete guide for installing and running OnTheGo Scanner on Windows 10/11.

---

## Quick Start (No Hardware Required)

Test the application without any hardware using mock data mode:

### 1. Download Installer

Download the latest Windows installer from the [Releases](https://github.com/yourusername/radioscanner/releases) page:
- `onthego-scanner-X.X.X-x64-setup.exe` (NSIS installer)
- `onthego-scanner-X.X.X-x64.exe` (Portable version)

### 2. Install

**NSIS Installer:**
- Double-click the setup.exe file
- Follow the installation wizard
- Choose installation directory
- Select shortcuts to create

**Portable Version:**
- No installation needed
- Run directly from any location

### 3. Run with Mock Data

Launch with simulated data (no hardware needed):

**Option A: Environment Variable (PowerShell)**
```powershell
$env:USE_MOCK_DATA="true"
& "C:\Program Files\OnTheGo Scanner\OnTheGo Scanner.exe"
```

**Option B: Environment Variable (Command Prompt)**
```cmd
set USE_MOCK_DATA=true
"C:\Program Files\OnTheGo Scanner\OnTheGo Scanner.exe"
```

**Option C: Create Shortcut**
1. Right-click desktop → New → Shortcut
2. Target: `"C:\Program Files\OnTheGo Scanner\OnTheGo Scanner.exe"`
3. Start in: `C:\Program Files\OnTheGo Scanner`
4. Advanced → Add `USE_MOCK_DATA=true` to environment variables

### 4. Verify Installation

The application should:
- Launch without errors
- Show the main window
- Display map panel
- Show simulated aircraft and drone data
- Display RF spectrum activity

---

## Full Hardware Setup

For real hardware integration (RTL-SDR, Bluetooth, GPS).

### Prerequisites

#### Windows Version
- Windows 10 (64-bit) or newer
- Windows 11 recommended

#### Administrative Access
Some setup steps require administrator privileges.

---

## Hardware Support

### Feature Comparison

| Feature | Windows Support | Requirements |
|---------|-----------------|--------------|
| **UI/UX** | ✅ Full | None |
| **Mock Data Mode** | ✅ Full | None |
| **Database** | ✅ Full | None |
| **RTL-SDR** | ✅ Full | RTL-SDR drivers + Zadig |
| **Bluetooth Remote ID** | ⚠️ Requires Setup | windows-build-tools + Zadig |
| **ADS-B (dump1090)** | ❌ Not Native | Use dump1090-win1090 or WSL2 |
| **Wi-Fi Remote ID (Kismet)** | ⚠️ Experimental | Kismet for Windows (beta) |
| **GPS (gpsd)** | ❌ Not Available | Future: direct serial port |

---

## RTL-SDR Setup

For RF spectrum analysis and aircraft tracking.

### 1. Install RTL-SDR Drivers

**Download:**
- Visit: https://www.rtl-sdr.com/
- Download: RTL-SDR driver package for Windows

**Install:**
```powershell
# Extract downloaded ZIP
# Run install-rtl-sdr.bat as Administrator
```

### 2. Install WinUSB Driver (Zadig)

**Download Zadig:**
- Visit: https://zadig.akeo.ie/
- Download: zadig.exe

**Install Driver:**
1. Plug in RTL-SDR dongle
2. Run Zadig as Administrator
3. Options → List All Devices
4. Select "RTL2838UHIDIR" or "Bulk-In, Interface (Interface 0)"
5. Select "WinUSB" driver
6. Click "Install Driver" or "Replace Driver"
7. Wait for installation to complete

### 3. Test RTL-SDR

```powershell
# Test the dongle
rtl_test

# Should output:
# Found 1 device(s):
#   0:  Realtek, RTL2838UHIDIR, SN: 00000001
```

### 4. Run RTL-TCP Server

```powershell
# Start RTL-TCP server
rtl_tcp -a 127.0.0.1 -p 1234

# Leave running, start OnTheGo Scanner in another terminal
```

---

## Bluetooth Setup

For drone Remote ID detection via Bluetooth Low Energy.

### 1. Install windows-build-tools

**Run PowerShell as Administrator:**
```powershell
npm install --global --production windows-build-tools
```

This installs:
- Visual Studio Build Tools
- Python (for node-gyp)
- Windows SDK

**Note:** This may take 15-30 minutes.

### 2. Install WinUSB Driver for Bluetooth

**Using Zadig:**
1. Plug in Bluetooth adapter (or use built-in Bluetooth)
2. Run Zadig as Administrator
3. Options → List All Devices
4. Select your Bluetooth adapter
5. Select "WinUSB" driver
6. Click "Install Driver"

**⚠️ Warning:** This will make the Bluetooth adapter unavailable for normal Windows Bluetooth use. To revert:
- Device Manager → Bluetooth adapter → Uninstall driver
- Scan for hardware changes

### 3. Verify Bluetooth

After setup, when you start OnTheGo Scanner, check console for:
```
[BluetoothRidClient] Windows detected - ensure Bluetooth adapter configured with Zadig
[BluetoothRidClient] Initialized - waiting for Bluetooth to power on
```

---

## Advanced: ADS-B with dump1090

dump1090 is not natively available on Windows. Options:

### Option A: Use Mock Data
Recommended for most Windows users.

### Option B: dump1090-win1090 (Community Port)
1. Search for "dump1090-win1090" on GitHub
2. Download and install
3. Configure OnTheGo Scanner to connect to it

### Option C: WSL2 (Windows Subsystem for Linux)
1. Install WSL2
2. Install Ubuntu
3. Set up dump1090 in WSL
4. Expose TCP port to Windows
5. Configure OnTheGo Scanner

**Note:** WSL2 USB support is limited and complex.

---

## Troubleshooting

### Application Won't Start

**Issue:** Double-clicking does nothing

**Solutions:**
1. Check Windows Security/Defender didn't block it
   - Settings → Windows Security → Virus & threat protection
   - Protection history → Allow the file
2. Run as Administrator (right-click → Run as administrator)
3. Check Windows Event Viewer:
   - Event Viewer → Windows Logs → Application
   - Look for errors with source "OnTheGo Scanner"

### "MSVCP140.dll is missing"

**Solution:** Install Visual C++ Redistributable
- Download: https://aka.ms/vs/17/release/vc_redist.x64.exe
- Run installer
- Restart application

### Bluetooth Not Working

**Issue:** `[BluetoothRidClient] Failed to initialize Bluetooth`

**Checks:**
1. Verify windows-build-tools installed:
   ```powershell
   npm list -g windows-build-tools
   ```
2. Verify WinUSB driver installed:
   - Device Manager → Universal Serial Bus devices
   - Look for device with WinUSB driver
3. Check console for specific error message
4. Try running as Administrator

**Re-install WinUSB:**
- Use Zadig to reinstall driver
- Restart computer
- Restart application

### RTL-SDR Not Detected

**Issue:** No RF spectrum data

**Checks:**
1. RTL-TCP server running?
   ```powershell
   netstat -an | findstr "1234"
   # Should show: TCP 127.0.0.1:1234 LISTENING
   ```
2. WinUSB driver installed for RTL-SDR?
   - Device Manager → Universal Serial Bus devices
   - Look for RTL2838 with WinUSB
3. Test RTL-SDR directly:
   ```powershell
   rtl_test
   ```

### Database Errors

**Issue:** "Database is locked" or corruption

**Solutions:**
1. Close all instances of OnTheGo Scanner
2. Check for .wal and .shm files:
   ```powershell
   cd "%APPDATA%\..\Local\OnTheGo Scanner"
   dir *.wal *.shm
   ```
3. Delete .wal and .shm files if found
4. Restart application

**Database Location:**
- Settings: `%LOCALAPPDATA%\OnTheGo Scanner\data\settings.sqlite`
- Session: `%LOCALAPPDATA%\OnTheGo Scanner\data\session.sqlite`

### Performance Issues

**Issue:** Application is slow or laggy

**Solutions:**
1. Disable Windows Defender real-time scanning for app folder:
   - Settings → Windows Security → Virus & threat protection
   - Manage settings → Add exclusion → Folder
   - Add: `C:\Program Files\OnTheGo Scanner`
2. Close other resource-intensive applications
3. Check Task Manager for high CPU/memory usage
4. Try mock data mode to isolate issue

### "Port Already in Use"

**Issue:** Backend fails to start, port 3000 in use

**Check what's using the port:**
```powershell
netstat -ano | findstr ":3000"
```

**Kill the process:**
```powershell
taskkill /PID <PID> /F
```

### Firewall Blocking Connection

**Issue:** Backend can't connect to services

**Solution:**
1. Windows Defender Firewall → Allow an app
2. Browse → Select OnTheGo Scanner.exe
3. Allow on Private and Public networks
4. Restart application

---

## Configuration

### Environment Variables

Set before launching application:

```powershell
# Mock data mode
$env:USE_MOCK_DATA="true"

# Custom backend port
$env:BACKEND_PORT="3001"

# Custom database location
$env:SETTINGS_DB_FILE="C:\Data\onthego\settings.sqlite"
$env:SESSION_DB_FILE="C:\Data\onthego\session.sqlite"
```

### Configuration Files

Edit `%LOCALAPPDATA%\OnTheGo Scanner\config.json` for persistent settings.

---

## Uninstallation

### NSIS Installer Version

1. Settings → Apps → Apps & features
2. Find "OnTheGo Scanner"
3. Click Uninstall

**Or:**

1. Run uninstaller: `C:\Program Files\OnTheGo Scanner\Uninstall OnTheGo Scanner.exe`

### Portable Version

Simply delete the application folder.

### Remove User Data

```powershell
# Remove settings and data
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\OnTheGo Scanner"
```

---

## Support

### Getting Help

1. **Documentation:** https://github.com/yourusername/radioscanner/wiki
2. **Issues:** https://github.com/yourusername/radioscanner/issues
3. **Discussions:** https://github.com/yourusername/radioscanner/discussions

### Reporting Bugs

Include:
- Windows version (run `winver`)
- Application version (Help → About)
- Error messages from console
- Steps to reproduce
- Hardware configuration (if applicable)

### Known Limitations on Windows

- dump1090 requires alternative solutions
- Kismet support is experimental
- GPS (gpsd) not available
- Some native services require Linux
- Full feature set works best on Linux

---

## Recommended Configuration for Windows

**Best Experience:**
```
✅ Mock Data Mode - Full functionality, no hardware
✅ RTL-SDR - Works well with proper driver setup
⚠️ Bluetooth - Possible but requires driver changes
❌ dump1090 - Use alternatives or WSL2
❌ Kismet - Limited Windows support
❌ GPS - Not currently available
```

**For full hardware support, consider:**
- Dual-boot with Linux
- Run Linux in VM
- Use WSL2 (advanced)
- Linux is the recommended platform for production use

---

## Next Steps

- [Development Guide](WINDOWS_BUILD.md) - Building from source
- [User Guide](USER_GUIDE.md) - Using the application
- [Developer Guide](DEVELOPMENT.md) - Contributing to development
