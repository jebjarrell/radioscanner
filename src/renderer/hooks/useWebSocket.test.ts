import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WSHandlers } from '../services/wsReconnect';
import type { TelemetryFrame } from '../types';

import { useWebSocket } from './useWebSocket';

// Capture the handlers passed into connectWS so the test can drive the socket
// lifecycle without a real WebSocket.
const stop = vi.fn();
let capturedHandlers: WSHandlers | undefined;

vi.mock('../services/wsReconnect', () => ({
  connectWS: (_url: string, handlers: WSHandlers) => {
    capturedHandlers = handlers;
    return stop;
  },
}));

const makeFrame = (): TelemetryFrame =>
  ({
    timestamp: '2024-01-01T00:00:00Z',
    aircraft: [],
    drone: { ridAvailable: true, detections: [] },
    signals: { rtlTcpConnected: true, gpsConnected: false },
  }) as unknown as TelemetryFrame;

describe('useWebSocket', () => {
  beforeEach(() => {
    capturedHandlers = undefined;
    stop.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts disconnected with no telemetry', () => {
    const { result } = renderHook(() => useWebSocket('ws://test'));
    expect(result.current.connected).toBe(false);
    expect(result.current.telemetry).toBeNull();
  });

  it('marks connected on open and disconnected on close/error', () => {
    const { result } = renderHook(() => useWebSocket('ws://test'));

    act(() => capturedHandlers?.onOpen?.(new Event('open')));
    expect(result.current.connected).toBe(true);

    act(() => capturedHandlers?.onClose?.(new CloseEvent('close')));
    expect(result.current.connected).toBe(false);

    act(() => capturedHandlers?.onOpen?.(new Event('open')));
    act(() => capturedHandlers?.onError?.(new Event('error')));
    expect(result.current.connected).toBe(false);
  });

  it('updates telemetry from a valid string frame', () => {
    const { result } = renderHook(() => useWebSocket('ws://test'));
    const frame = makeFrame();
    act(() => {
      capturedHandlers?.onMessage?.({ data: JSON.stringify(frame) } as MessageEvent);
    });
    expect(result.current.telemetry).toEqual(frame);
  });

  it('decodes binary (typed array view) payloads', () => {
    const { result } = renderHook(() => useWebSocket('ws://test'));
    const frame = makeFrame();
    const bytes = new TextEncoder().encode(JSON.stringify(frame));
    act(() => {
      capturedHandlers?.onMessage?.({ data: bytes } as unknown as MessageEvent);
    });
    expect(result.current.telemetry).toEqual(frame);
  });

  it('drops malformed JSON without crashing or updating state', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useWebSocket('ws://test'));
    act(() => {
      capturedHandlers?.onMessage?.({ data: '{not json' } as MessageEvent);
    });
    expect(result.current.telemetry).toBeNull();
    warn.mockRestore();
  });

  it('drops non-object (wrong-shape) messages', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useWebSocket('ws://test'));
    act(() => {
      capturedHandlers?.onMessage?.({ data: 'null' } as MessageEvent);
    });
    act(() => {
      capturedHandlers?.onMessage?.({ data: '42' } as MessageEvent);
    });
    expect(result.current.telemetry).toBeNull();
    warn.mockRestore();
  });

  it('ignores unsupported payload types without throwing', () => {
    const { result } = renderHook(() => useWebSocket('ws://test'));
    act(() => {
      capturedHandlers?.onMessage?.({ data: 123 } as unknown as MessageEvent);
    });
    expect(result.current.telemetry).toBeNull();
  });

  it('keeps the last good frame after a subsequent bad frame', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useWebSocket('ws://test'));
    const frame = makeFrame();
    act(() => {
      capturedHandlers?.onMessage?.({ data: JSON.stringify(frame) } as MessageEvent);
    });
    act(() => {
      capturedHandlers?.onMessage?.({ data: 'oops' } as MessageEvent);
    });
    expect(result.current.telemetry).toEqual(frame);
    warn.mockRestore();
  });

  it('calls stop() on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('ws://test'));
    unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
});
