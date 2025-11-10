/**
 * Map Style Definitions
 * Available map tile styles for MapLibre GL
 */

export interface MapStyleOption {
  id: string;
  name: string;
  url: string;
  attribution: string;
}

export const MAP_STYLES: Record<string, MapStyleOption> = {
  demotiles: {
    id: 'demotiles',
    name: 'MapLibre Demo Tiles',
    url: 'https://demotiles.maplibre.org/style.json',
    attribution: 'MapLibre',
  },
  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: '© OpenStreetMap contributors',
  },
  dark: {
    id: 'dark',
    name: 'Dark Mode',
    url: 'https://tiles.openfreemap.org/styles/dark',
    attribution: '© OpenStreetMap contributors',
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://tiles.openfreemap.org/styles/satellite',
    attribution: '© OpenStreetMap contributors',
  },
};

/**
 * Get map style URL by ID
 */
export function getMapStyleUrl(styleId: string): string {
  const style = MAP_STYLES[styleId];
  if (!style) {
    // Fallback to demotiles if unknown style ID
    return MAP_STYLES.demotiles.url;
  }
  return style.url;
}

/**
 * Get all available map style IDs
 */
export function getAvailableStyleIds(): string[] {
  return Object.keys(MAP_STYLES);
}
