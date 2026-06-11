import { describe, expect, it } from 'vitest';

import { MAP_STYLES, getAvailableStyleIds, getMapStyleUrl } from './mapStyles';

describe('getMapStyleUrl', () => {
  it('returns the URL for a known style id', () => {
    expect(getMapStyleUrl('osm')).toBe(MAP_STYLES.osm.url);
    expect(getMapStyleUrl('dark')).toBe(MAP_STYLES.dark.url);
  });

  it('falls back to the offline style for an unknown id', () => {
    expect(getMapStyleUrl('does-not-exist')).toBe('/maps/style.json');
    expect(getMapStyleUrl('does-not-exist')).toBe(MAP_STYLES.offline.url);
  });

  it('falls back to offline for an empty id', () => {
    expect(getMapStyleUrl('')).toBe('/maps/style.json');
  });
});

describe('getAvailableStyleIds', () => {
  it('returns all configured style ids', () => {
    const ids = getAvailableStyleIds();
    expect(ids).toEqual(Object.keys(MAP_STYLES));
    expect(ids).toContain('offline');
    expect(ids).toContain('satellite');
  });
});
