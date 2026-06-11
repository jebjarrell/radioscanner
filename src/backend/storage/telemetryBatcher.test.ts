import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TelemetryBatcher } from './telemetryBatcher.js';

describe('TelemetryBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes immediately once the batch size is reached', () => {
    const onFlush = vi.fn();
    const batcher = new TelemetryBatcher<number>(onFlush, 3, 5_000);

    batcher.enqueue(1);
    batcher.enqueue(2);
    expect(onFlush).not.toHaveBeenCalled();

    batcher.enqueue(3);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('flushes on the timer when below the batch size', () => {
    const onFlush = vi.fn();
    const batcher = new TelemetryBatcher<number>(onFlush, 100, 5_000);

    batcher.enqueue(1);
    batcher.enqueue(2);
    expect(onFlush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5_000);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([1, 2]);
  });

  it('does not schedule duplicate timers for consecutive enqueues', () => {
    const onFlush = vi.fn();
    const batcher = new TelemetryBatcher<number>(onFlush, 100, 5_000);

    batcher.enqueue(1);
    vi.advanceTimersByTime(2_000);
    batcher.enqueue(2);
    // Timer should still fire 5s after the first enqueue, batching both items.
    vi.advanceTimersByTime(3_000);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([1, 2]);
  });

  it('does not flush when the buffer is empty', () => {
    const onFlush = vi.fn();
    const batcher = new TelemetryBatcher<number>(onFlush, 100, 5_000);
    batcher.flush();
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('clears the buffer after a flush so the next interval is empty', () => {
    const onFlush = vi.fn();
    const batcher = new TelemetryBatcher<number>(onFlush, 100, 5_000);
    batcher.enqueue(1);
    vi.advanceTimersByTime(5_000);
    vi.advanceTimersByTime(5_000);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('flushes any pending records on dispose', () => {
    const onFlush = vi.fn();
    const batcher = new TelemetryBatcher<number>(onFlush, 100, 5_000);
    batcher.enqueue(1);
    batcher.dispose();
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([1]);
  });

  it('does not flush after dispose when the buffer was empty', () => {
    const onFlush = vi.fn();
    const batcher = new TelemetryBatcher<number>(onFlush, 100, 5_000);
    batcher.dispose();
    expect(onFlush).not.toHaveBeenCalled();
  });
});
