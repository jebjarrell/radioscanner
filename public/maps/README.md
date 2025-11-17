# Offline Map Tiles

## Current Status

The app currently uses a **simple offline fallback** with a dark background. This allows the app to run without internet, but doesn't display actual map tiles.

## Adding Real Offline Tiles

To add proper offline map tiles, you need to generate MBTiles for your region of interest:

### Option 1: Using OpenMapTiles (Recommended)

1. **Generate tiles** using [OpenMapTiles](https://openmaptiles.org/):
   ```bash
   # Install tools
   npm install -g @mapbox/mbtiles

   # Or use Docker
   docker pull openmaptiles/openmaptiles-tools
   ```

2. **Download region** from [OpenMapTiles downloads](https://openmaptiles.org/downloads/planet/)
   - Choose your region (e.g., North America, Europe)
   - Download the `.mbtiles` file
   - Recommended zoom levels: 0-14 (~500MB-2GB)

3. **Place the file** in this directory:
   ```
   public/maps/tiles.mbtiles
   ```

4. **Update style.json** to reference your tiles:
   ```json
   {
     "sources": {
       "openmaptiles": {
         "type": "vector",
         "url": "mbtiles://./tiles.mbtiles"
       }
     }
   }
   ```

### Option 2: Using TileMaker

```bash
# Install TileMaker
sudo apt-get install tilemaker

# Generate tiles from OSM data
tilemaker --input your-region.osm.pbf --output tiles.mbtiles

# Copy to maps directory
cp tiles.mbtiles public/maps/
```

### Option 3: Download from Mapbox

1. Sign up for [Mapbox](https://www.mapbox.com/)
2. Use their Tilesets API to download offline tiles
3. Export as MBTiles format

## Tile Size Estimates

| Zoom Levels | Coverage | Approximate Size |
|-------------|----------|------------------|
| 0-10 | Global | ~50-100 MB |
| 0-12 | Regional | ~200-500 MB |
| 0-14 | Detailed | ~500MB-2GB |
| 0-16 | Street-level | ~5-20 GB |

## Serving Tiles

### Development Mode

The app loads tiles from `public/maps/style.json`. Vite serves these during development.

### Production Mode

When built, tiles are bundled in the Electron app's resources. The renderer loads them via the local file protocol.

## Testing Offline Mode

1. Place your `tiles.mbtiles` file in `public/maps/`
2. Update `style.json` to reference the tiles
3. Disconnect from internet
4. Run the app - map should display offline tiles

## Resources

- [MapLibre GL JS Documentation](https://maplibre.org/maplibre-gl-js-docs/)
- [MBTiles Specification](https://github.com/mapbox/mbtiles-spec)
- [OpenMapTiles](https://openmaptiles.org/)
- [TileMaker](https://github.com/systemed/tilemaker)

## Current Implementation

The app falls back to a simple dark background when no tiles are available. This ensures the app remains functional offline while displaying markers and overlays correctly.
