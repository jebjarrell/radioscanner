import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppSettings } from '../../backend/services/settingsParser';

import { useDistanceUnit } from './useDistanceUnit';

const settingsMock = vi.fn();

vi.mock('./useSettings', () => ({
  useSettings: () => settingsMock(),
}));

const withSettings = (settings: Partial<AppSettings> | null): void => {
  settingsMock.mockReturnValue({ settings, loading: false, error: null });
};

describe('useDistanceUnit', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to miles when settings are missing', () => {
    withSettings(null);
    const { result } = renderHook(() => useDistanceUnit());
    expect(result.current).toBe('miles');
  });

  it('defaults to miles for an unrecognised unit', () => {
    withSettings({ preferences: { distanceUnit: 'furlongs' } } as unknown as AppSettings);
    const { result } = renderHook(() => useDistanceUnit());
    expect(result.current).toBe('miles');
  });

  it('returns kilometers when configured', () => {
    withSettings({ preferences: { distanceUnit: 'kilometers' } } as unknown as AppSettings);
    const { result } = renderHook(() => useDistanceUnit());
    expect(result.current).toBe('kilometers');
  });

  it('returns nautical when configured', () => {
    withSettings({ preferences: { distanceUnit: 'nautical' } } as unknown as AppSettings);
    const { result } = renderHook(() => useDistanceUnit());
    expect(result.current).toBe('nautical');
  });
});
