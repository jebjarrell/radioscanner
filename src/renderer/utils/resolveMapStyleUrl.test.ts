import { afterEach, describe, expect, it, vi } from 'vitest';

import { MAP_STYLES, resolveMapStyleUrl } from './mapStyles';

describe('resolveMapStyleUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('leaves local root-absolute paths untouched on http(s) origins', () => {
    vi.stubGlobal('window', { location: { protocol: 'http:' } });
    expect(resolveMapStyleUrl('offline')).toBe('/maps/style.json');
  });

  it('rewrites local root-absolute paths to document-relative under file://', () => {
    vi.stubGlobal('window', { location: { protocol: 'file:' } });
    expect(resolveMapStyleUrl('offline')).toBe('./maps/style.json');
  });

  it('does not rewrite absolute http(s) style URLs under file://', () => {
    vi.stubGlobal('window', { location: { protocol: 'file:' } });
    expect(resolveMapStyleUrl('osm')).toBe(MAP_STYLES.osm.url);
    expect(MAP_STYLES.osm.url.startsWith('https://')).toBe(true);
  });

  it('falls back to the offline style for unknown ids', () => {
    vi.stubGlobal('window', { location: { protocol: 'http:' } });
    expect(resolveMapStyleUrl('does-not-exist')).toBe(MAP_STYLES.offline.url);
  });
});
