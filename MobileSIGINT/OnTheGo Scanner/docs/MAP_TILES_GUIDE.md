# Map Tiles Guide for OnTheGo Scanner

## Your Requirements

- **Coverage:** Contiguous United States
- **Detail level:** 30 miles visible in each direction (~60 mile width)
- **Zoom level:** 0-10 (level 10 = ~29 mile width)
- **Purpose:** Ship as base map with the application

## File Size Summary

| Format | Size | Quality | Recommendation |
|--------|------|---------|----------------|
| **Vector tiles (MBTiles)** | **200-400 MB** | Excellent | ✅ **RECOMMENDED** |
| Raster tiles (PNG) | 800 MB - 1.5 GB | Good | ⚠️ Too large |
| PMTiles (vector) | 150-300 MB | Excellent | 🔄 Future option |

## Answer: YES, This Makes Sense!

**Recommended approach:**
- Use **vector tiles** in MBTiles format
- Expected file size: **~250-350 MB** for zoom 0-10
- Quality: Perfect for aviation use (shows cities, roads, state boundaries)
- Performance: Fast loading, smooth zoom

## Option 1: OpenMapTiles (Easiest, Best Quality)

### Pros
- Pre-generated, production-ready
- Best quality and style support
- ~250 MB for US zoom 0-10
- No generation time needed

### Cons
- Requires account (free tier available)
- Manual download step

### Steps
```bash
# 1. Visit OpenMapTiles
open https://openmaptiles.com/downloads/north-america/us/

# 2. Create free account

# 3. Download settings:
#    - Region: United States
#    - Format: MBTiles (vector)
#    - Zoom levels: 0-10
#    - Download size: ~250 MB

# 4. Place the downloaded file
mv ~/Downloads/us-tiles.mbtiles public/maps/tiles.mbtiles

# 5. Configure the app
./scripts/setup-offline-maps.sh
# Choose option 2: Vector tiles

# 6. Done! Start the app
npm run dev
```

**Cost:** FREE (up to 10 downloads/month on free tier)

## Option 2: Generate with TileMaker (Free, Open Source)

### Pros
- Completely free
- No account needed
- Customizable

### Cons
- Takes 30-60 minutes to generate
- Requires ~5 GB temporary disk space
- Needs CPU power

### Steps
```bash
# Automated script handles everything
./scripts/download-tiles.sh
# Choose option 2: Geofabrik + TileMaker

# This will:
# 1. Install tilemaker (if needed)
# 2. Download US OSM data (~1.2 GB)
# 3. Generate tiles (~30-60 min)
# 4. Clean up temporary files
# 5. Install tiles at public/maps/tiles.mbtiles
```

**Cost:** FREE (but time-consuming)

## Option 3: Protomaps (Future)

PMTiles format is newer and more efficient but requires updating MapLibre configuration.

**Status:** Not yet implemented in the app. Potential future enhancement.

## Recommended Setup for Shipping

### For Production Release

**Ship the app with tiles included:**

```bash
# 1. Generate or download tiles ONCE
./scripts/download-tiles.sh

# 2. Verify tiles exist
ls -lh public/maps/tiles.mbtiles
# Should show ~250-350 MB file

# 3. Configure vector style
./scripts/setup-offline-maps.sh
# Choose option 2

# 4. Build the app
npm run build

# Result: AppImage includes the tiles
# Total app size: ~300-400 MB (app + tiles)
```

### For Development

**Start with dark background, add tiles later:**

```bash
# 1. Quick setup with no tiles
./scripts/setup-offline-maps.sh
# Choose option 1: Dark background

# 2. App works immediately (markers visible on dark bg)
npm run dev

# 3. Add real tiles later when ready
./scripts/download-tiles.sh
./scripts/setup-offline-maps.sh
```

## What Gets Displayed at Each Zoom Level

With zoom 0-10 vector tiles:

| Zoom | View Width | What's Visible |
|------|------------|----------------|
| 0-3 | Whole US | State outlines only |
| 4-5 | Multi-state | State boundaries, major cities |
| 6-7 | State | Cities, major highways |
| 8-9 | Metro area | Roads, towns, water bodies |
| 10 | ~30 miles | Streets, neighborhoods, detail |

**Your requirement (30 mile view) = Zoom level 10** ✅

## File Structure After Setup

```
public/maps/
├── style.json              # Active style (symlink or copy)
├── style-vector.json       # Vector tile style template
├── tiles.mbtiles          # Your map tiles (~250-350 MB)
└── README.md              # Tile generation docs
```

## Performance Implications

### App Size
- **Without tiles:** ~50-70 MB (app only)
- **With tiles:** ~300-420 MB (app + tiles)

### Loading Time
- **Initial load:** +200-500ms (one-time cost)
- **Zoom/pan:** Instant (tiles cached)
- **Offline:** No difference (all local)

### Memory Usage
- **RAM:** +50-100 MB while running
- **Disk cache:** Minimal (Service Worker)

## Testing the Setup

```bash
# 1. Verify tiles are loaded
npm run dev

# 2. Open DevTools Console (F12)
# Look for:
# [MapLibre] Loading tiles from mbtiles://./tiles.mbtiles
# [MapLibre] Loaded zoom 0-10

# 3. Test zoom levels
# - Zoom out: Should see state boundaries
# - Zoom in: Should see cities, roads, detail
# - Max zoom (10): Should show ~30 mile view

# 4. Test offline
# - Disconnect internet
# - Refresh app
# - Map should still work perfectly
```

## Troubleshooting

### "Map is blank"
```bash
# Check if tiles exist
ls -lh public/maps/tiles.mbtiles

# Check style configuration
cat public/maps/style.json | grep mbtiles

# Verify tile format
file public/maps/tiles.mbtiles
# Should show: SQLite 3.x database
```

### "Tiles not loading"
```bash
# Check MapLibre console errors
# Open DevTools → Console
# Look for tile loading errors

# Common fixes:
# 1. Ensure style.json references correct path
# 2. Check tiles.mbtiles is not corrupted
# 3. Verify zoom levels match (0-10)
```

### "File too large"
```bash
# Reduce zoom levels (e.g., 0-9 instead of 0-10)
# This cuts file size by ~40-50%

# Or use lower quality compression
# Acceptable quality with 30% smaller files
```

## Comparison with Current Setup

| Aspect | Current (Dark BG) | With Tiles |
|--------|-------------------|------------|
| File size | ~50 MB | ~300 MB |
| Map detail | None (dark only) | Full detail |
| User experience | Markers visible | Full map context |
| Offline capable | ✅ Yes | ✅ Yes |
| Zoom levels | Any | 0-10 |

## Recommendation

**For your use case (ship with base US map):**

1. **Use OpenMapTiles vector tiles** (easiest, best quality)
2. **Download zoom 0-10** (~250 MB)
3. **Include in AppImage** (total ~350 MB app size)
4. **Ship as default** (users get full offline maps out of the box)

**Alternative (smaller download):**
1. **Ship with dark background** (~50 MB app)
2. **Provide tile download script** (users download tiles post-install)
3. **Document in README** ("Run ./scripts/download-tiles.sh for maps")

## Next Steps

Choose your approach:

**Option A - Ship with tiles (recommended):**
```bash
./scripts/download-tiles.sh      # Download tiles once
./scripts/setup-offline-maps.sh  # Configure
npm run build                    # Build with tiles included
```

**Option B - Ship minimal, download later:**
```bash
./scripts/setup-offline-maps.sh  # Configure dark background
npm run build                    # Build without tiles
# Users run ./scripts/download-tiles.sh after install
```

## Support

- OpenMapTiles: https://openmaptiles.com/
- Geofabrik OSM: https://download.geofabrik.de/
- TileMaker: https://github.com/systemed/tilemaker
- MapLibre: https://maplibre.org/

Need help? Check OFFLINE_MODE.md or open an issue.
