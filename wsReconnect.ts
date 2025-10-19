/**
 * wsReconnect.ts
 * Lightweight WebSocket connector with exponential backoff + jitter.
 *
 * Usage:
 *   const stop = connectWS('ws://127.0.0.1:3000/ws', {
 *     onOpen: () => {},
 *     onMessage: (ev) => {},
 *     onClose: () => {},
 *     onError: (ev) => {},
 *   }, { initialDelayMs: 1000, maxDelayMs: 15000, factor: 2 });
 *   // later: stop();
 */

export interface WSHandlers {
  onOpen?: (ev: Event) => void;
  onMessage?: (ev: MessageEvent) => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
}

export interface WSReconnectOptions {
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  randomJitterMs?: number;
  protocols?: string | string[];
}

export function connectWS(url: string, handlers: WSHandlers = {}, opts: WSReconnectOptions = {}) {
  let ws: WebSocket | null = null;
  let delay = Math.max(250, opts.initialDelayMs ?? 1000);
  const maxDelay = Math.max(delay, opts.maxDelayMs ?? 15000);
  const factor = Math.max(1.1, opts.factor ?? 2);
  const jitter = Math.max(0, opts.randomJitterMs ?? 250);
  let stopped = false;

  const start = () => {
    if (stopped) return;
    try {
      ws = new WebSocket(url, opts.protocols);
      ws.onopen = (ev) => {
        delay = Math.max(250, opts.initialDelayMs ?? 1000);
        handlers.onOpen?.(ev);
      };
      ws.onmessage = (ev) => handlers.onMessage?.(ev);
      ws.onerror = (ev) => {
        try {
          handlers.onError?.(ev);
        } finally {
          try {
            ws?.close();
          } catch (closeErr) {
            if (process.env.NODE_ENV !== 'production') {
              console.debug('wsReconnect: error during close after onError', closeErr);
            }
          }
        }
      };
      ws.onclose = (ev) => {
        handlers.onClose?.(ev);
        if (!stopped) {
          const backoff = Math.min(maxDelay, delay * factor);
          const withJitter = backoff + Math.floor(Math.random() * jitter);
          delay = withJitter;
          setTimeout(start, delay);
        }
      };
    } catch (err) {
      // schedule retry
      const backoff = Math.min(maxDelay, delay * factor);
      const withJitter = backoff + Math.floor(Math.random() * jitter);
      delay = withJitter;
      setTimeout(start, delay);
    }
  };

  start();
  return () => {
    stopped = true;
    try {
      ws?.close();
    } catch (closeErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('wsReconnect: error during close on stop', closeErr);
      }
    }
  };
}
