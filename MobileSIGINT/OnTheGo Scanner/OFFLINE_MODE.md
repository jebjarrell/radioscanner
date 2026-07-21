# Offline Mode Guide

This guide explains how the OnTheGo Scanner works offline and what features are available without an internet connection.

## Overview

OnTheGo Scanner is designed to operate **fully offline** on Linux systems. The app has been enhanced with offline-first capabilities including:

- ✅ **Local map tiles** - No external CDN dependencies
- ✅ **Service Worker caching** - Static assets cached for offline use
- ✅ **IndexedDB telemetry cache** - Last received data persists between sessions
- ✅ **SQLite persistence** - Aircraft and signal data stored locally
- ✅ **Mock data mode** - Full UI testing without hardware services

## How Offline Mode Works

### 1. Map Display

**Status:** Offline-ready with basic fallback

The app no longer depends on external map tile servers. It uses a local map style with:

- **Current:** Dark background fallback (always works offline)
- **Optional:** Add your own MBTiles for detailed maps (see [Adding Map Tiles](#adding-map-tiles))

**File:** `public/maps/style.json`

### 2. Static Asset Caching

**Status:** Fully implemented

A Service Worker caches all static assets:

- HTML, CSS, JavaScript files
- MapLibre GL styles
- Local map resources

**Implementation:**
- Service Worker: `/public/service-worker.js`
- Registration: `src/renderer/main.tsx:19-36`

The app will load instantly from cache when offline, even after restarts.

### 3. Telemetry Data Caching

**Status:** Fully implemented

IndexedDB stores the last received telemetry frames:

- **Capacity:** Last 10 telemetry frames
- **Aircraft records:** Last 500 unique aircraft
- **Persistence:** Survives browser/app restarts
- **Automatic cleanup:** Old data pruned automatically

**Implementation:**
- Cache service: `src/renderer/services/telemetryCache.ts`
- Integration: `src/renderer/contexts/TelemetryContext.tsx`

### 4. Offline UI Indicators

**Status:** Fully implemented

The app shows clear visual feedback about data freshness:

- 🟢 **Green badge:** "Telemetry: streaming" (live data)
- 🟡 **Yellow badge:** "Telemetry: offline (cached Xm ago)" (showing cached data)
- 🔴 **Red badge:** "Telemetry: offline" (no data available)

**File:** `src/renderer/map/MapPanel.ts:298-322`

## Offline Features

### Available Offline

✅ **App startup and UI** - Full interface loads from cache
✅ **Map display** - Dark background with markers and overlays
✅ **Cached aircraft data** - Last received aircraft positions
✅ **Cached telemetry** - Last health status and signals
✅ **Settings panel** - View and modify settings
✅ **Export to CSV** - Export cached data
✅ **Database management** - Save/load sessions

### Requires Local Services

⚠️ **Live telemetry** - Needs backend running on `localhost:3000`
⚠️ **Aircraft tracking** - Requires dump1090 service
⚠️ **Drone detection** - Requires Kismet service
⚠️ **RF spectrum** - Requires rtl_tcp service
⚠️ **GPS positioning** - Requires gpsd service (or manual fallback)

### Mock Data Mode

For testing without hardware services:

```bash
USE_MOCK_DATA=1 npm run dev
```

This simulates all services with synthetic data.

## Adding Map Tiles

To add proper offline map tiles instead of the dark background:

### Option 1: Quick Start (Pre-generated Tiles)

1. Download pre-generated MBTiles:
   - [OpenMapTiles Downloads](https://openmaptiles.org/downloads/)
   - Choose your region (North America, Europe, etc.)
   - Download zoom levels 0-14 (~500MB-2GB)

2. Place the file:
   ```bash
   mv downloads/your-region.mbtiles public/maps/tiles.mbtiles
   ```

3. Update `public/maps/style.json` to reference the tiles:
   ```json
   {
     "version": 8,
     "sources": {
       "openmaptiles": {
         "type": "vector",
         "url": "mbtiles://./tiles.mbtiles"
       }
     },
     "layers": [/* add appropriate layers */]
   }
   ```

### Option 2: Generate Custom Tiles

Using [TileMaker](https://github.com/systemed/tilemaker):

```bash
# Install TileMaker
sudo apt-get install tilemaker

# Download OSM data for your region
wget https://download.geofabrik.de/north-america/us-latest.osm.pbf

# Generate tiles
tilemaker --input us-latest.osm.pbf --output public/maps/tiles.mbtiles

# Clean up
rm us-latest.osm.pbf
```

### Option 3: Use Mapbox Studio

1. Sign up for [Mapbox](https://www.mapbox.com/)
2. Create a custom style in Mapbox Studio
3. Export as MBTiles
4. Place in `public/maps/tiles.mbtiles`

See `public/maps/README.md` for detailed instructions.

## Architecture

### Offline Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                │
│  • Starts Fastify backend (localhost:3000)             │
│  • No external network dependencies                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│                  Fastify Backend (Node.js)              │
│  • WebSocket server (ws://127.0.0.1:3000/ws)           │
│  • REST API endpoints (/api/*)                          │
│  • SQLite databases (session + settings)                │
│  • Aggregates local hardware services                   │
└─────────────────────────────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────┐
│               Renderer Process (React + Vite)           │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Service Worker                                    │  │
│  │  • Caches static assets                          │  │
│  │  • Offline-first strategy                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ IndexedDB Cache                                   │  │
│  │  • Telemetry frames (last 10)                    │  │
│  │  • Aircraft records (last 500)                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ TelemetryProvider                                 │  │
│  │  • Manages WebSocket connection                  │  │
│  │  • Caches incoming frames                        │  │
│  │  • Falls back to cached data when offline       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ MapLibre GL                                       │  │
│  │  • Loads local style.json                        │  │
│  │  • Renders from local/bundled tiles              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### CSP Configuration

The Content Security Policy no longer allows external connections:

**Before (online-dependent):**
```javascript
connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:* https://demotiles.maplibre.org
img-src 'self' blob: data: https://demotiles.maplibre.org
```

**After (offline-first):**
```javascript
connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*
img-src 'self' blob: data:
```

**File:** `src/main/index.ts:14-24`

## Testing Offline Mode

### Test 1: Disconnect Network

```bash
# Start the app normally
npm run dev

# Wait for data to load
# Disconnect WiFi/ethernet
# App should show yellow "cached" badge
# Last received aircraft should still be visible
```

### Test 2: Cold Start Offline

```bash
# Ensure you have cached data from a previous session
# Disconnect network
# Start app
npm run dev

# Should load from cache immediately
# UI should be fully functional
# Map should show dark background with cached markers
```

### Test 3: Mock Mode (No Hardware)

```bash
# Test without any hardware services
USE_MOCK_DATA=1 npm run dev

# Should show synthetic aircraft and drone data
# All UI features should work
# No errors about missing services
```

### Test 4: Service Worker

Open DevTools (F12) → Application → Service Workers

- Should show "activated and running"
- Cache Storage should show "onthego-scanner-v1" and "onthego-runtime-v1"
- Check cached resources

## API Endpoints

### Get Cached Aircraft

```http
GET http://127.0.0.1:3000/api/aircraft/cached?limit=200
```

Returns last-seen aircraft from SQLite database.

**Response:**
```json
{
  "aircraft": [
    {
      "icao": "A12345",
      "callsign": "UAL123",
      "altitude": 35000,
      "speed": 450,
      "heading": 180,
      "lat": 40.7128,
      "lon": -74.0060,
      "vertical_rate": 0,
      "squawk": "1234",
      "last_seen": 1234567890
    }
  ]
}
```

**File:** `src/backend/server.ts:399-404`

## Troubleshooting

### Map shows blank/black screen

**Cause:** Local map style has no tiles configured.

**Solution:**
- Basic: Dark background is intentional - markers will still display
- Advanced: Add MBTiles (see [Adding Map Tiles](#adding-map-tiles))

### "Service Worker registration failed"

**Cause:** Service workers require HTTPS or localhost.

**Solution:**
- In Electron, this should work automatically
- If in browser, ensure you're on `http://localhost` or `https://`

### Cached data not loading

**Cause:** IndexedDB quota exceeded or corrupted.

**Solution:**
```javascript
// Open DevTools console
indexedDB.deleteDatabase('OnTheGoScanner');
// Refresh the app
```

### "Failed to cache frame" errors

**Cause:** Browser storage quota exceeded.

**Solution:**
- Check disk space
- Clear old data: DevTools → Application → Clear Storage

### Backend not starting

**Cause:** Port 3000 already in use.

**Solution:**
```bash
# Use custom port
BACKEND_PORT=3001 npm run dev
```

## Performance

### Storage Usage

| Component | Size | Limit |
|-----------|------|-------|
| Service Worker cache | ~5-10 MB | ~50 MB |
| IndexedDB (telemetry) | ~100-500 KB | ~50 MB |
| SQLite (session) | ~1-10 MB | Unlimited |
| MBTiles (optional) | 500 MB - 2 GB | Disk space |

### Load Times

| Scenario | First Load | Subsequent Loads |
|----------|------------|------------------|
| Online (no cache) | ~2-3 seconds | ~2-3 seconds |
| Offline (cached) | ~200-500 ms | ~200-500 ms |
| With MBTiles | +500 ms | +200 ms |

## Development

### Clearing Cache During Development

To test fresh installations:

```javascript
// In browser DevTools console:

// Clear Service Worker
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(r => r.unregister());
});

// Clear IndexedDB
indexedDB.deleteDatabase('OnTheGoScanner');

// Clear Cache Storage
caches.keys().then(keys => {
  keys.forEach(key => caches.delete(key));
});
```

Or use DevTools → Application → Clear Storage → "Clear site data"

### Debugging Service Worker

```bash
# In DevTools console
navigator.serviceWorker.controller.postMessage({
  type: 'CLEAR_CACHE'
});
```

### Monitoring Cache Stats

```javascript
// In console
import { telemetryCache } from './src/renderer/services/telemetryCache';

telemetryCache.getStats().then(stats => {
  console.log('Frame count:', stats.frameCount);
  console.log('Aircraft count:', stats.aircraftCount);
});
```

## Security

### Local-Only Operation

The app enforces strict CSP to prevent data leaks:

- ❌ No external network requests allowed
- ❌ No external scripts or stylesheets
- ❌ No CDN dependencies
- ✅ All resources served from localhost or local files
- ✅ All data stored in local SQLite/IndexedDB

### Data Privacy

All telemetry and aircraft data:
- Never leaves your computer
- Stored in local databases only
- Can be deleted anytime
- Not transmitted over network (except localhost)

## Future Enhancements

Potential improvements for offline mode:

1. **Smarter cache management** - Automatically clear old frames based on storage quota
2. **Offline tile generation** - Built-in tool to generate tiles from OSM data
3. **Prefetch nearby tiles** - Download tiles for current GPS region
4. **Offline route recording** - Store aircraft paths for later analysis
5. **Service Worker updates** - Background updates when online

## Related Files

- `/public/maps/style.json` - Map style configuration
- `/public/maps/README.md` - Detailed tile generation guide
- `/public/service-worker.js` - Service Worker implementation
- `src/renderer/services/telemetryCache.ts` - IndexedDB cache
- `src/renderer/contexts/TelemetryContext.tsx` - Telemetry provider with caching
- `src/backend/storage/aircraftDb.ts` - SQLite aircraft database
- `src/main/index.ts` - CSP configuration

## Support

If you encounter issues with offline mode:

1. Check browser console for errors
2. Verify Service Worker is registered (DevTools → Application)
3. Check IndexedDB has data (DevTools → Application → IndexedDB)
4. Ensure backend is running on localhost:3000
5. Try clearing cache and reloading

For more help, see the [main README](./README.md) or open an issue on GitHub.
