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

/** Bundled local style used for fully offline operation (no network required). */
export const LOCAL_OFFLINE_STYLE_URL = '/maps/style.json';

/** Default style id. Keeps the app on the bundled local offline style. */
export const DEFAULT_MAP_STYLE_ID = 'demotiles';

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
 * Resolve a map style id to a style URL. The default 'demotiles' id (and any
 * empty value) keeps the bundled local offline style so the app works with no
 * network; any other explicit selection resolves through the style catalog.
 */
export function resolveMapStyleUrl(styleId?: string): string {
  if (!styleId || styleId === DEFAULT_MAP_STYLE_ID) {
    return LOCAL_OFFLINE_STYLE_URL;
  }
  return getMapStyleUrl(styleId);
}

/**
 * Get all available map style IDs
 */
export function getAvailableStyleIds(): string[] {
  return Object.keys(MAP_STYLES);
}
