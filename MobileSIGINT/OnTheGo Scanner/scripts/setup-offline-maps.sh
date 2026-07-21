#!/bin/bash
#
# Quick setup for offline maps
# This script helps you set up map tiles for offline use
#

set -e

SCRIPT_DIR="$(dirname "$0")"
MAPS_DIR="$SCRIPT_DIR/../public/maps"
STYLE_FILE="$MAPS_DIR/style.json"

echo "=== OnTheGo Scanner - Offline Maps Setup ==="
echo ""
echo "This will configure your map tiles for offline use."
echo ""

# Check if tiles exist
if [ -f "$MAPS_DIR/tiles.mbtiles" ]; then
    echo "✅ Map tiles found: $(du -h "$MAPS_DIR/tiles.mbtiles" | cut -f1)"
    TILES_EXIST=true
else
    echo "⚠️  No tiles found at: $MAPS_DIR/tiles.mbtiles"
    TILES_EXIST=false
fi

echo ""
echo "Choose map style:"
echo ""
echo "1. Dark background only (works now, no tiles needed, 0 MB)"
echo "2. Vector tiles (best quality, requires tiles.mbtiles, ~200-400 MB)"
echo ""

if [ "$TILES_EXIST" = false ]; then
    echo "Since you don't have tiles yet, option 1 is recommended."
    echo "You can download tiles later with: ./scripts/download-tiles.sh"
fi

echo ""
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        echo "Setting up dark background style..."
        cat > "$STYLE_FILE" << 'EOF'
{
  "version": 8,
  "name": "OnTheGo Scanner Offline",
  "metadata": {
    "maputnik:renderer": "maplibre"
  },
  "sources": {},
  "sprite": "",
  "glyphs": "",
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#1a1a1a"
      }
    }
  ]
}
EOF
        echo "✅ Dark background style configured"
        ;;

    2)
        if [ "$TILES_EXIST" = false ]; then
            echo ""
            echo "⚠️  Warning: No tiles found!"
            echo ""
            echo "To download tiles, run:"
            echo "  ./scripts/download-tiles.sh"
            echo ""
            read -p "Continue anyway? [y/N] " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo "Cancelled. Please download tiles first."
                exit 0
            fi
        fi

        echo "Setting up vector tile style..."
        cp "$MAPS_DIR/style-vector.json" "$STYLE_FILE"
        echo "✅ Vector tile style configured"
        ;;

    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Current map style: $STYLE_FILE"
echo ""
echo "To test:"
echo "1. Start the app: npm run dev"
echo "2. Map should load with $([ "$choice" = "1" ] && echo "dark background" || echo "vector tiles")"
echo ""

if [ "$TILES_EXIST" = false ] && [ "$choice" = "1" ]; then
    echo "To add proper map tiles later:"
    echo "1. Run: ./scripts/download-tiles.sh"
    echo "2. Run: ./scripts/setup-offline-maps.sh"
    echo "3. Choose option 2 (Vector tiles)"
    echo ""
fi
