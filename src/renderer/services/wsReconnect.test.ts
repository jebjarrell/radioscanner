import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connectWS } from './wsReconnect';

type Listener = ((ev: unknown) => void) | null;

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;

  url: string;
  protocols?: string | string[];
  onopen: Listener = null;
  onmessage: Listener = null;
  onclose: Listener = null;
  onerror: Listener = null;
  close = vi.fn();

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
  }

  emitOpen(): void {
    this.onopen?.(new Event('open'));
  }

  emitClose(): void {
    this.onclose?.(new CloseEvent('close'));
  }

  emitError(): void {
    this.onerror?.(new Event('error'));
  }
}

describe('connectWS', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens a socket immediately and forwards lifecycle callbacks', () => {
    const onOpen = vi.fn();
    const onMessage = vi.fn();
    const stop = connectWS('ws://x', { onOpen, onMessage });

    expect(MockWebSocket.instances).toHaveLength(1);
    const ws = MockWebSocket.instances[0];
    ws.emitOpen();
    expect(onOpen).toHaveBeenCalledOnce();

    ws.onmessage?.({ data: 'hi' });
    expect(onMessage).toHaveBeenCalledWith({ data: 'hi' });

    stop();
  });

  it('closes the socket on error', () => {
    const onError = vi.fn();
    const stop = connectWS('ws://x', { onError });
    const ws = MockWebSocket.instances[0];
    ws.emitError();
    expect(onError).toHaveBeenCalledOnce();
    expect(ws.close).toHaveBeenCalled();
    stop();
  });

  it('reconnects after close with exponential backoff', () => {
    // No jitter for deterministic delays. initial 1000, factor 2.
    const stop = connectWS('ws://x', {}, { initialDelayMs: 1000, factor: 2, randomJitterMs: 0 });
    expect(MockWebSocket.instances).toHaveLength(1);

    MockWebSocket.instances[0].emitClose();
    // First backoff: 1000 * 2 = 2000ms
    vi.advanceTimersByTime(1999);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);

    MockWebSocket.instances[1].emitClose();
    // Next backoff: 2000 * 2 = 4000ms
    vi.advanceTimersByTime(3999);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3);

    stop();
  });

  it('caps the backoff at maxDelayMs', () => {
    const stop = connectWS(
      'ws://x',
      {},
      { initialDelayMs: 1000, factor: 10, maxDelayMs: 1500, randomJitterMs: 0 },
    );
    MockWebSocket.instances[0].emitClose();
    // backoff would be 10000 but capped to 1500
    vi.advanceTimersByTime(1500);
    expect(MockWebSocket.instances).toHaveLength(2);
    stop();
  });

  it('resets the backoff to the initial delay after a successful open', () => {
    const stop = connectWS('ws://x', {}, { initialDelayMs: 1000, factor: 2, randomJitterMs: 0 });
    MockWebSocket.instances[0].emitClose();
    vi.advanceTimersByTime(2000); // reconnect #2
    expect(MockWebSocket.instances).toHaveLength(2);

    // Successful open resets delay back to initial
    MockWebSocket.instances[1].emitOpen();
    MockWebSocket.instances[1].emitClose();
    // backoff should be 1000 * 2 = 2000 again (not continuing to grow)
    vi.advanceTimersByTime(1999);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3);
    stop();
  });

  it('keeps jittered delay within [backoff, backoff + jitter)', () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    const stop = connectWS('ws://x', {}, { initialDelayMs: 1000, factor: 2, randomJitterMs: 500 });
    MockWebSocket.instances[0].emitClose();
    // backoff 2000 + floor(0.999999 * 500) = 2000 + 499 = 2499
    vi.advanceTimersByTime(2498);
    expect(MockWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(2);
    randomSpy.mockRestore();
    stop();
  });

  it('does not reconnect after stop() is called', () => {
    const stop = connectWS('ws://x', {}, { initialDelayMs: 1000, randomJitterMs: 0 });
    const ws = MockWebSocket.instances[0];
    stop();
    expect(ws.close).toHaveBeenCalled();
    ws.emitClose();
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('schedules a reconnect when the WebSocket constructor throws', () => {
    vi.stubGlobal(
      'WebSocket',
      class {
        constructor() {
          throw new Error('boom');
        }
      } as unknown as typeof WebSocket,
    );
    // Should not throw; schedules retry via timer.
    const stop = connectWS('ws://x', {}, { initialDelayMs: 1000, randomJitterMs: 0 });
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    stop();
  });
});
