#!/bin/bash
#
# Download and prepare US map tiles for OnTheGo Scanner
#
# This script downloads pre-generated OpenMapTiles for the United States
# at zoom levels 0-10, which provides ~30 mile view at max zoom.
#

set -e

MAPS_DIR="$(dirname "$0")/../public/maps"
DOWNLOAD_DIR="$MAPS_DIR/downloads"
TILES_FILE="$MAPS_DIR/tiles.mbtiles"

echo "=== OnTheGo Scanner - US Map Tile Downloader ==="
echo ""

# Create directories
mkdir -p "$DOWNLOAD_DIR"
mkdir -p "$MAPS_DIR"

echo "Map tiles directory: $MAPS_DIR"
echo "Download directory: $DOWNLOAD_DIR"
echo ""

# Check if tiles already exist
if [ -f "$TILES_FILE" ]; then
    echo "⚠️  Tiles already exist at: $TILES_FILE"
    echo "   File size: $(du -h "$TILES_FILE" | cut -f1)"
    read -p "   Replace existing tiles? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing tiles. Exiting."
        exit 0
    fi
    rm "$TILES_FILE"
fi

echo "Choose tile source:"
echo ""
echo "1. OpenMapTiles (Pre-generated, vector tiles, ~250-400 MB)"
echo "   - Recommended for production"
echo "   - Requires OpenMapTiles account (free tier available)"
echo "   - Download from: https://openmaptiles.com/downloads/north-america/us/"
echo ""
echo "2. Geofabrik OSM Extract + TileMaker (Generate locally, ~300-500 MB)"
echo "   - Free, no account needed"
echo "   - Takes 30-60 minutes to generate"
echo "   - Requires ~5 GB temporary disk space"
echo ""
echo "3. Protomaps (Pre-generated, free, ~200 MB)"
echo "   - Completely free, no account"
echo "   - Smaller file size"
echo "   - Good quality for aviation use"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "=== OpenMapTiles Download ==="
        echo ""
        echo "📋 Manual Download Required:"
        echo ""
        echo "1. Visit: https://openmaptiles.com/downloads/north-america/us/"
        echo "2. Create free account or log in"
        echo "3. Download: 'United States of America' (Vector tiles)"
        echo "4. Select zoom levels: 0-10"
        echo "5. Format: MBTiles"
        echo "6. Save the downloaded file to:"
        echo "   $DOWNLOAD_DIR/us-tiles.mbtiles"
        echo ""
        read -p "Press Enter when download is complete..."

        if [ ! -f "$DOWNLOAD_DIR/us-tiles.mbtiles" ]; then
            echo "❌ Error: File not found at $DOWNLOAD_DIR/us-tiles.mbtiles"
            exit 1
        fi

        echo "✅ Found downloaded tiles"
        mv "$DOWNLOAD_DIR/us-tiles.mbtiles" "$TILES_FILE"
        ;;

    2)
        echo ""
        echo "=== Generate Tiles with TileMaker ==="
        echo ""

        # Check for tilemaker
        if ! command -v tilemaker &> /dev/null; then
            echo "Installing TileMaker..."
            sudo apt-get update
            sudo apt-get install -y tilemaker
        fi

        echo "Downloading US OSM extract from Geofabrik..."
        OSM_FILE="$DOWNLOAD_DIR/us-latest.osm.pbf"

        if [ ! -f "$OSM_FILE" ]; then
            wget -O "$OSM_FILE" \
                "https://download.geofabrik.de/north-america/us-latest.osm.pbf"
        else
            echo "Using existing OSM file: $OSM_FILE"
        fi

        echo "Generating tiles (this will take 30-60 minutes)..."
        tilemaker \
            --input "$OSM_FILE" \
            --output "$TILES_FILE" \
            --process /usr/share/tilemaker/process-openmaptiles.lua \
            --config /usr/share/tilemaker/config-openmaptiles.json \
            --bbox=-125,24,-66,50

        echo "Cleaning up OSM file..."
        rm "$OSM_FILE"
        ;;

    3)
        echo ""
        echo "=== Protomaps Download ==="
        echo ""

        # Protomaps provides free tiles
        echo "Downloading Protomaps tiles for US..."

        # Note: Protomaps uses PMTiles format, need to convert to MBTiles
        # or update the app to support PMTiles

        echo "❌ Protomaps requires PMTiles format support"
        echo "   This is not yet implemented in the app."
        echo "   Please choose option 1 or 2 instead."
        exit 1
        ;;

    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "=== Installation Complete ==="
echo ""
echo "✅ Map tiles installed at: $TILES_FILE"
echo "   File size: $(du -h "$TILES_FILE" | cut -f1)"
echo ""
echo "Next steps:"
echo "1. Update public/maps/style.json to use the new tiles"
echo "2. Restart the app: npm run dev"
echo ""
echo "To verify tiles are working:"
echo "- Open DevTools Console"
echo "- Look for MapLibre loading messages"
echo "- Check that map displays correctly"
echo ""
