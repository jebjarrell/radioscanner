/**
 * utils/backoff.ts
 * Shared backend helper for scheduling reconnect attempts with exponential
 * backoff and jitter. Designed for persistent-socket clients (rtl_tcp, gpsd)
 * that need to self-heal when an external service drops or is absent at start.
 *
 * Renderer code has its own connector (src/renderer/services/wsReconnect.ts);
 * this helper is backend-only and must not import it.
 */

export interface BackoffOptions {
  /** Delay before the first retry, in ms. Defaults to 1000. */
  initialDelayMs?: number;
  /** Upper bound for the computed delay, in ms. Defaults to 30000. */
  maxDelayMs?: number;
  /** Multiplier applied to the delay after each attempt. Defaults to 2. */
  factor?: number;
  /** Maximum random jitter added on top of each delay, in ms. Defaults to 1000. */
  jitterMs?: number;
}

/**
 * Schedules retry callbacks with exponential backoff + jitter.
 *
 * The controller owns a single pending timer at a time. Call `schedule()` to
 * queue the next attempt, `reset()` after a successful connection to return to
 * the initial delay, and `cancel()` on shutdown to clear any pending timer.
 */
export class BackoffController {
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly factor: number;
  private readonly jitterMs: number;

  private currentDelayMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: BackoffOptions = {}) {
    this.initialDelayMs = Math.max(1, options.initialDelayMs ?? 1_000);
    this.maxDelayMs = Math.max(this.initialDelayMs, options.maxDelayMs ?? 30_000);
    this.factor = Math.max(1.1, options.factor ?? 2);
    this.jitterMs = Math.max(0, options.jitterMs ?? 1_000);
    this.currentDelayMs = this.initialDelayMs;
  }

  /** True while a retry is pending. */
  isPending(): boolean {
    return this.timer !== null;
  }

  /**
   * Schedule the next retry. Replaces any pending timer. The delay grows
   * geometrically (capped at maxDelayMs) across consecutive calls until reset.
   * Returns the delay used, in ms.
   */
  schedule(callback: () => void): number {
    this.cancel();

    const base = Math.min(this.currentDelayMs, this.maxDelayMs);
    const delay = base + Math.floor(Math.random() * this.jitterMs);

    this.timer = setTimeout(() => {
      this.timer = null;
      callback();
    }, delay);
    // Don't keep the event loop alive purely for a reconnect attempt.
    this.timer.unref?.();

    this.currentDelayMs = Math.min(this.currentDelayMs * this.factor, this.maxDelayMs);
    return delay;
  }

  /** Cancel any pending retry without resetting the delay. */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Cancel any pending retry and return the delay to its initial value. */
  reset(): void {
    this.cancel();
    this.currentDelayMs = this.initialDelayMs;
  }
}
