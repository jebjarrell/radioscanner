import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettings } from './useSettings';

const okJson = (body: unknown): Response =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

describe('useSettings', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches settings on mount and exposes them', async () => {
    const settings = { preferences: { distanceUnit: 'kilometers' } };
    fetchMock.mockResolvedValueOnce(okJson(settings));

    const { result } = renderHook(() => useSettings());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings).toEqual(settings);
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/settings'));
  });

  it('sets an error when the fetch responds non-ok', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings).toBeNull();
    expect(result.current.error).toContain('500');
  });

  it('sets an error when the fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('updateSetting posts the change and refetches', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ preferences: {} })) // initial load
      .mockResolvedValueOnce(okJson({ requiresRestart: true })) // POST
      .mockResolvedValueOnce(okJson({ preferences: { distanceUnit: 'miles' } })); // refetch

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: { success: boolean; requiresRestart: boolean } | undefined;
    await waitFor(async () => {
      outcome = await result.current.updateSetting('preferences.distanceUnit', 'miles');
    });

    expect(outcome).toEqual({ success: true, requiresRestart: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/settings'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('updateSetting returns failure on error without throwing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock
      .mockResolvedValueOnce(okJson({ preferences: {} }))
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response);

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await result.current.updateSetting('k', 'v');
    expect(outcome).toEqual({ success: false, requiresRestart: false });
    errSpy.mockRestore();
  });

  it('testConnection returns the backend result', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ preferences: {} }))
      .mockResolvedValueOnce(okJson({ success: true, latencyMs: 12 }));

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await result.current.testConnection('dump1090', 'localhost', 30005);
    expect(outcome).toEqual({ success: true, latencyMs: 12 });
  });

  it('testConnection returns a failure object when the request rejects', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ preferences: {} }))
      .mockRejectedValueOnce(new Error('refused'));

    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await result.current.testConnection('gps', 'localhost', 2947);
    expect(outcome).toEqual({ success: false, error: 'refused' });
  });
});
