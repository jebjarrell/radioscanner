# RF Scanner - Quick Implementation Reference

## 🚨 CRITICAL FIXES (Do These First!)

### 1. Fix DUMP1090 Interface

```javascript
// ❌ DON'T USE PORT 30003 SBS TEXT
// ✅ USE HTTP JSON POLLING
const DUMP1090_URL = 'http://localhost:8080/data/aircraft.json';
setInterval(() => fetch(DUMP1090_URL), 1000); // Poll every second
```

### 2. Add Input Validation

```javascript
// Validate ALL external data
if (!aircraft.hex || !/^[a-f0-9]{6}$/i.test(aircraft.hex)) {
  return null; // Invalid ICAO
}
if (aircraft.lat < -90 || aircraft.lat > 90) {
  return null; // Invalid latitude
}
```

### 3. Set Resource Limits

```javascript
const LIMITS = {
  MAX_AIRCRAFT: 500,
  MAX_DRONES: 100,
  MAX_SIGNALS: 1000,
  WATERFALL_ROWS: 100,
};
```

## 📋 Service Health Checks

### DUMP1090

```javascript
// Check: HTTP endpoint responds
fetch('http://localhost:8080/data/aircraft.json')
  .then((res) => res.json())
  .then(() => console.log('✅ DUMP1090 OK'))
  .catch(() => console.log('❌ DUMP1090 FAIL'));
```

### Kismet

```javascript
// Check: REST API responds
fetch('http://localhost:2501/system/status.json')
  .then(() => console.log('✅ Kismet OK'))
  .catch(() => console.log('❌ Kismet FAIL'));
```

### RTL-SDR

```javascript
// Check: rtl_tcp connects
const socket = net.connect(1234, '127.0.0.1');
socket.on('connect', () => console.log('✅ RTL-SDR OK'));
socket.on('error', () => console.log('❌ RTL-SDR FAIL'));
```

### GPS

```javascript
// Check: gpsd responds
const gps = net.connect(2947, '127.0.0.1');
gps.on('connect', () => {
  gps.write('?WATCH={"enable":true,"json":true}\n');
  console.log('✅ GPS OK');
});
```

## 🔧 Common Issues & Quick Fixes

| Problem             | Solution                 | Command                                      |
| ------------------- | ------------------------ | -------------------------------------------- |
| No aircraft shown   | Start DUMP1090           | `sudo systemctl start dump1090-mutability`   |
| No drones detected  | Start Kismet             | `kismet --daemonize --silent`                |
| RTL-SDR not found   | Check USB                | `rtl_test -t`                                |
| GPS no fix          | Go outside or set manual | `gpspipe -w -n 5`                            |
| High memory usage   | Restart services         | `sudo systemctl restart dump1090-mutability` |
| Port already in use | Find and kill            | `lsof -i :3000` then `kill -9 <PID>`         |

## 🏗️ Development Shortcuts

### Start All Services

```bash
#!/bin/bash
sudo systemctl start dump1090-mutability
kismet --daemonize --silent
sudo systemctl start gpsd
rtl_tcp -a 127.0.0.1 -p 1234 &
```

### Mock Mode (No Hardware)

```bash
USE_MOCK_DATA=true npm start
```

### Test With Sample Data

```javascript
// In backend/server.js
if (process.env.USE_MOCK_DATA) {
  const mock = require('./mock-generator');
  mock.start(wss);
}
```

## 📊 Performance Checklist

- [ ] Waterfall using Float32Array (not objects)
- [ ] Database writes batched (100 records)
- [ ] WebSocket messages < 1MB
- [ ] Map markers clustered if > 50
- [ ] React components use React.memo()
- [ ] FFT in Web Worker (not main thread)

## 🔒 Security Checklist

- [ ] All services bound to 127.0.0.1 (not 0.0.0.0)
- [ ] Electron: `nodeIntegration: false`
- [ ] Electron: `contextIsolation: true`
- [ ] Input validation on all external data
- [ ] Resource limits enforced
- [ ] No eval() or Function() constructors

## 📦 Build Commands

```bash
# Development
npm run backend      # Start backend only
npm run frontend     # Start frontend only
npm run electron:dev # Full app development

# Production
npm run build        # Create .deb and AppImage
npm test            # Run all tests
npm run lint        # Check code style
```

## 🧪 Test Without Hardware

1. Set environment variable: `export USE_MOCK_DATA=true`
2. Start the app: `npm start`
3. Mock data will simulate:
   - 10 aircraft moving
   - 3 drones with operators
   - 20 RF signals
   - GPS position

## 🚀 Deployment Checklist

### Before Release

- [ ] All services start automatically
- [ ] Error messages are user-friendly
- [ ] Export function tested
- [ ] Session cleanup confirmed
- [ ] Memory usage < 650MB after 1 hour
- [ ] CPU usage < 50% during scanning

### Package Contents

```
dist/
├── OnTheGoScanner_1.0.0_amd64.deb    # Debian/Ubuntu
├── OnTheGoScanner-1.0.0.AppImage     # Universal Linux
└── checksums.txt                      # SHA256 hashes
```

## 📝 Quick SQL Queries

```sql
-- Count aircraft in last minute
SELECT COUNT(*) FROM aircraft
WHERE last_seen > datetime('now', '-1 minute');

-- Find strongest signals
SELECT frequency_mhz, signal_strength FROM rf_signals
ORDER BY signal_strength DESC LIMIT 10;

-- Check database size
SELECT page_count * page_size / 1024.0 / 1024.0 as size_mb
FROM pragma_page_count(), pragma_page_size();

-- Clear old data
DELETE FROM aircraft WHERE last_seen < datetime('now', '-1 hour');
DELETE FROM drones WHERE last_seen < datetime('now', '-1 hour');
DELETE FROM rf_signals WHERE timestamp < datetime('now', '-1 hour');
```

## 🆘 Emergency Debugging

### Check Everything

```bash
#!/bin/bash
echo "=== Service Status ==="
systemctl status dump1090-mutability | grep Active
systemctl status gpsd | grep Active
ps aux | grep kismet

echo "=== Port Status ==="
netstat -tlnp | grep -E "3000|3001|8080|2501|2947|1234"

echo "=== USB Devices ==="
lsusb | grep -E "RTL|Realtek|HackRF"

echo "=== GPS Status ==="
timeout 2 gpspipe -w -n 1 || echo "No GPS fix"

echo "=== Memory Usage ==="
ps aux | grep -E "electron|node" | awk '{sum+=$6} END {print sum/1024 " MB"}'
```

## 📞 Support Resources

- RTL-SDR Issues: https://www.rtl-sdr.com/rtl-sdr-quick-start-guide/
- Kismet Docs: https://www.kismetwireless.net/docs/
- DUMP1090 Help: https://github.com/flightaware/dump1090/blob/master/README.md
- MapLibre Examples: https://maplibre.org/maplibre-gl-js-docs/example/

Remember: **Start simple, test often, ship early!**
