import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAP_STYLE_ID,
  LOCAL_OFFLINE_STYLE_URL,
  MAP_STYLES,
  getMapStyleUrl,
  resolveMapStyleUrl,
} from './mapStyles';

describe('getMapStyleUrl', () => {
  it('returns the catalog URL for a known style id', () => {
    expect(getMapStyleUrl('dark')).toBe(MAP_STYLES.dark.url);
  });

  it('falls back to the demo style URL for an unknown id', () => {
    expect(getMapStyleUrl('does-not-exist')).toBe(MAP_STYLES.demotiles.url);
  });
});

describe('resolveMapStyleUrl', () => {
  it('uses the local offline style when no id is provided', () => {
    expect(resolveMapStyleUrl()).toBe(LOCAL_OFFLINE_STYLE_URL);
    expect(resolveMapStyleUrl('')).toBe(LOCAL_OFFLINE_STYLE_URL);
  });

  it('keeps the default id on the local offline style (offline-first)', () => {
    expect(resolveMapStyleUrl(DEFAULT_MAP_STYLE_ID)).toBe(LOCAL_OFFLINE_STYLE_URL);
  });

  it('resolves an explicit non-default id through the catalog', () => {
    expect(resolveMapStyleUrl('satellite')).toBe(MAP_STYLES.satellite.url);
  });
});
