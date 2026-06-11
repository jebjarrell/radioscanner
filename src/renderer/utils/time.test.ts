import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatTimeSince, isStale } from './time';

describe('formatTimeSince', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for very recent timestamps', () => {
    expect(formatTimeSince(NOW - 1_000)).toBe('just now');
    expect(formatTimeSince(NOW)).toBe('just now');
  });

  it('clamps future timestamps to "just now"', () => {
    expect(formatTimeSince(NOW + 10_000)).toBe('just now');
  });

  it('formats seconds', () => {
    expect(formatTimeSince(NOW - 30_000)).toBe('30s ago');
  });

  it('formats minutes', () => {
    expect(formatTimeSince(NOW - 5 * 60_000)).toBe('5m ago');
  });

  it('formats hours', () => {
    expect(formatTimeSince(NOW - 3 * 60 * 60_000)).toBe('3h ago');
  });
});

describe('isStale', () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not stale within the default threshold', () => {
    expect(isStale(NOW - 30_000)).toBe(false);
  });

  it('is stale past the default 60s threshold', () => {
    expect(isStale(NOW - 61_000)).toBe(true);
  });

  it('respects a custom threshold', () => {
    expect(isStale(NOW - 11_000, 10)).toBe(true);
    expect(isStale(NOW - 9_000, 10)).toBe(false);
  });
});
