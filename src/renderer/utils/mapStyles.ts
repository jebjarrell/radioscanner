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
  offline: {
    id: 'offline',
    name: 'Offline (Local Tiles)',
    url: '/maps/style.json',
    attribution: 'Local tiles',
  },
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
    // Unknown ids fall back to the bundled offline style so the map renders without network
    return MAP_STYLES.offline.url;
  }
  return style.url;
}

/**
 * Get all available map style IDs
 */
export function getAvailableStyleIds(): string[] {
  return Object.keys(MAP_STYLES);
}

/**
 * Resolve a map style URL for the current runtime.
 *
 * The bundled offline style is configured with a root-absolute path
 * (`/maps/style.json`) which works under the dev server and any http(s)
 * origin. In packaged Electron builds the renderer is loaded from
 * `file://.../dist/index.html`, where a root-absolute path resolves to
 * `file:///maps/style.json` and fails. Rewrite local root-absolute paths to
 * be document-relative so the bundled `dist/maps/` assets load offline.
 */
export function resolveMapStyleUrl(styleId: string): string {
  const url = getMapStyleUrl(styleId);
  const isFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
  if (isFileProtocol && url.startsWith('/')) {
    return `.${url}`;
  }
  return url;
}
