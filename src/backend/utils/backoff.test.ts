import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackoffController } from './backoff.js';

describe('BackoffController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Remove jitter so delays are deterministic.
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('grows the delay geometrically across schedules', () => {
    const controller = new BackoffController({
      initialDelayMs: 100,
      factor: 2,
      jitterMs: 0,
      maxDelayMs: 10_000,
    });

    expect(controller.schedule(() => undefined)).toBe(100);
    controller.cancel();
    expect(controller.schedule(() => undefined)).toBe(200);
    controller.cancel();
    expect(controller.schedule(() => undefined)).toBe(400);
  });

  it('caps the delay at maxDelayMs', () => {
    const controller = new BackoffController({
      initialDelayMs: 1_000,
      factor: 10,
      jitterMs: 0,
      maxDelayMs: 3_000,
    });

    expect(controller.schedule(() => undefined)).toBe(1_000);
    controller.cancel();
    expect(controller.schedule(() => undefined)).toBe(3_000);
    controller.cancel();
    expect(controller.schedule(() => undefined)).toBe(3_000);
  });

  it('adds jitter on top of the base delay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const controller = new BackoffController({
      initialDelayMs: 1_000,
      jitterMs: 400,
      factor: 2,
    });
    // base 1000 + floor(0.5 * 400) = 1200
    expect(controller.schedule(() => undefined)).toBe(1_200);
  });

  it('fires the callback after the scheduled delay', () => {
    const controller = new BackoffController({ initialDelayMs: 500, jitterMs: 0 });
    const cb = vi.fn();
    controller.schedule(cb);
    expect(controller.isPending()).toBe(true);
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(controller.isPending()).toBe(false);
  });

  it('replaces a pending timer when scheduled again', () => {
    const controller = new BackoffController({ initialDelayMs: 500, jitterMs: 0 });
    const first = vi.fn();
    const second = vi.fn();
    controller.schedule(first);
    controller.schedule(second);
    vi.advanceTimersByTime(2_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('cancel clears the pending timer without advancing the delay', () => {
    const controller = new BackoffController({ initialDelayMs: 100, factor: 2, jitterMs: 0 });
    const cb = vi.fn();
    expect(controller.schedule(cb)).toBe(100);
    controller.cancel();
    expect(controller.isPending()).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(cb).not.toHaveBeenCalled();
    // The next schedule continues from the advanced delay, not reset.
    expect(controller.schedule(() => undefined)).toBe(200);
  });

  it('reset returns the delay to the initial value', () => {
    const controller = new BackoffController({ initialDelayMs: 100, factor: 2, jitterMs: 0 });
    controller.schedule(() => undefined);
    controller.cancel();
    controller.schedule(() => undefined);
    controller.reset();
    expect(controller.isPending()).toBe(false);
    expect(controller.schedule(() => undefined)).toBe(100);
  });

  it('enforces a minimum initial delay and factor', () => {
    const controller = new BackoffController({ initialDelayMs: 0, factor: 1, jitterMs: 0 });
    // initialDelayMs floored to 1.
    expect(controller.schedule(() => undefined)).toBe(1);
    controller.cancel();
    // factor floored to 1.1 -> next base delay is 1 * 1.1 = 1.1.
    expect(controller.schedule(() => undefined)).toBeCloseTo(1.1);
  });
});
