// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { PeakDetector } from './peakDetector';

/** Build a flat noise floor with optional power spikes at specific bins. */
function makeBins(length: number, noise: number, spikes: Record<number, number> = {}): number[] {
  const bins = new Array<number>(length).fill(noise);
  for (const [bin, power] of Object.entries(spikes)) {
    bins[Number(bin)] = power;
  }
  return bins;
}

describe('PeakDetector.detectPeaks', () => {
  it('returns no peaks for fewer than 3 bins', () => {
    expect(new PeakDetector().detectPeaks([-50, -40], 0, 1000)).toEqual([]);
  });

  it('detects a single strong peak with correct frequency and SNR', () => {
    const bins = makeBins(64, -90, { 20: -30 });
    const peaks = new PeakDetector().detectPeaks(bins, 100_000_000, 1000);

    expect(peaks).toHaveLength(1);
    expect(peaks[0].bin).toBe(20);
    expect(peaks[0].frequency).toBe(100_020_000);
    expect(peaks[0].power).toBe(-30);
    expect(peaks[0].snr).toBe(60);
    expect(peaks[0].width).toBeGreaterThanOrEqual(1);
  });

  it('rejects peaks below the minimum SNR', () => {
    const bins = makeBins(16, -90, { 8: -86 }); // snr 4 < default 6
    expect(new PeakDetector().detectPeaks(bins, 0, 1000)).toEqual([]);
  });

  it('rejects peaks below the minimum absolute power', () => {
    const bins = makeBins(16, -90, { 8: -50 });
    const detector = new PeakDetector({ minPower: -40 });
    expect(detector.detectPeaks(bins, 0, 1000)).toEqual([]);
  });

  it('limits results to maxPeaks, keeping the strongest by SNR', () => {
    const bins = makeBins(32, -90, { 5: -20, 10: -30, 15: -40, 20: -50 });
    const peaks = new PeakDetector({ maxPeaks: 2 }).detectPeaks(bins, 0, 1000);

    expect(peaks).toHaveLength(2);
    expect(peaks.map((p) => p.bin)).toEqual([5, 10]);
  });
});

describe('PeakDetector.getNoiseFloor', () => {
  it('uses the minimum for the "min" method', () => {
    expect(new PeakDetector({ noiseMethod: 'min' }).getNoiseFloor([-90, -80, -100])).toBe(-100);
  });

  it('uses the median for the "median" method', () => {
    expect(new PeakDetector({ noiseMethod: 'median' }).getNoiseFloor([-90, -80, -100])).toBe(-90);
  });
});

describe('PeakDetector sensitivity', () => {
  it('exposes constructor defaults', () => {
    expect(new PeakDetector().getSensitivity()).toEqual({
      minSnrDb: 6,
      minPower: -80,
      minWidth: 1,
      maxPeaks: 50,
    });
  });

  it('updates only the provided values via setSensitivity', () => {
    const detector = new PeakDetector();
    detector.setSensitivity({ minSnrDb: 12, maxPeaks: 5 });
    expect(detector.getSensitivity()).toEqual({
      minSnrDb: 12,
      minPower: -80,
      minWidth: 1,
      maxPeaks: 5,
    });
  });
});

describe('PeakDetector history', () => {
  it('smooths a peak seen across frames and clears on demand', () => {
    const detector = new PeakDetector();
    const bins = makeBins(64, -90, { 20: -30 });

    detector.detectPeaks(bins, 100_000_000, 1000);
    detector.detectPeaks(bins, 100_000_000, 1000);

    expect(detector.getLastPeaks()).toHaveLength(1);

    const smoothed = detector.getSmoothedPeak(100_020_000);
    expect(smoothed?.bin).toBe(20);
    expect(smoothed?.frequency).toBeCloseTo(100_020_000, 0);

    detector.clearHistory();
    expect(detector.getLastPeaks()).toEqual([]);
    expect(detector.getSmoothedPeak(100_020_000)).toBeNull();
  });
});
