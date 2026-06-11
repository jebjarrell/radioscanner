import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TelemetryFrame } from '../types';

import { useNotifications } from './useNotifications';

const showToast = vi.fn();
const telemetryMock = vi.fn();
const settingsMock = vi.fn();
const userPositionMock = vi.fn();

vi.mock('../contexts/TelemetryContext', () => ({
  useTelemetry: () => telemetryMock(),
}));
vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));
vi.mock('./useSettings', () => ({
  useSettings: () => settingsMock(),
}));
vi.mock('./useUserPosition', () => ({
  useUserPosition: () => userPositionMock(),
}));

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

const setTelemetry = (frame: DeepPartial<TelemetryFrame> | null): void => {
  telemetryMock.mockReturnValue({ telemetry: frame, connected: true });
};

const setSettings = (notifications: Record<string, unknown> | undefined): void => {
  settingsMock.mockReturnValue({ settings: notifications ? { notifications } : {} });
};

describe('useNotifications', () => {
  beforeEach(() => {
    showToast.mockClear();
    userPositionMock.mockReturnValue({ lat: 40.73, lon: -73.93 });
    setSettings(undefined);
    setTelemetry(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing without telemetry', () => {
    const { rerender } = renderHook(() => useNotifications());
    rerender();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('shows a toast when a new drone is detected', () => {
    setTelemetry({ drone: { ridAvailable: true, detections: [] } });
    const { rerender } = renderHook(() => useNotifications());

    setTelemetry({
      drone: {
        ridAvailable: true,
        detections: [{ droneId: 'd1', manufacturer: 'DJI', model: 'Mini' }],
      },
    });
    rerender();

    expect(showToast).toHaveBeenCalledWith('Drone Detected: DJI Mini', 'info', expect.any(Number));
  });

  it('does not re-notify for the same drone id', () => {
    setTelemetry({ drone: { ridAvailable: true, detections: [{ droneId: 'd1' }] } });
    const { rerender } = renderHook(() => useNotifications());
    showToast.mockClear();

    setTelemetry({ drone: { ridAvailable: true, detections: [{ droneId: 'd1' }] } });
    rerender();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('respects the droneDetected disabled setting', () => {
    setSettings({ droneDetected: false });
    setTelemetry({ drone: { ridAvailable: true, detections: [] } });
    const { rerender } = renderHook(() => useNotifications());

    setTelemetry({ drone: { ridAvailable: true, detections: [{ droneId: 'new' }] } });
    rerender();
    expect(showToast).not.toHaveBeenCalled();
  });

  it('notifies on RTL-TCP connection status changes', () => {
    setTelemetry({ signals: { rtlTcpConnected: false, gpsConnected: false } });
    const { rerender } = renderHook(() => useNotifications());
    showToast.mockClear();

    setTelemetry({ signals: { rtlTcpConnected: true, gpsConnected: false } });
    rerender();
    expect(showToast).toHaveBeenCalledWith('RTL-TCP Connected', 'success', expect.any(Number));

    setTelemetry({ signals: { rtlTcpConnected: false, gpsConnected: false } });
    rerender();
    expect(showToast).toHaveBeenCalledWith('RTL-TCP Disconnected', 'error', expect.any(Number));
  });

  it('notifies on aircraft proximity when enabled', () => {
    setSettings({ aircraftProximity: true, aircraftProximityThresholdMiles: 100 });
    userPositionMock.mockReturnValue({ lat: 40.73, lon: -73.93 });
    setTelemetry({ aircraft: [] });
    const { rerender } = renderHook(() => useNotifications());

    setTelemetry({
      aircraft: [{ hex: 'abc', flight: 'UAL1', lat: 40.74, lon: -73.94 }],
    });
    rerender();

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('Aircraft UAL1 within'),
      'warning',
      expect.any(Number),
    );
  });

  it('does nothing when notifications are globally disabled', () => {
    setSettings({ enabled: false });
    setTelemetry({ drone: { ridAvailable: true, detections: [] } });
    const { rerender } = renderHook(() => useNotifications());

    setTelemetry({ drone: { ridAvailable: true, detections: [{ droneId: 'x' }] } });
    rerender();
    expect(showToast).not.toHaveBeenCalled();
  });
});
