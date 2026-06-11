import { describe, expect, it } from 'vitest';

import { PeakDetector } from './peakDetector.js';

/** Build a flat noise floor with optional peaks injected at given bins. */
const spectrum = (length: number, floor: number, peaks: Record<number, number> = {}): number[] => {
  const bins = new Array<number>(length).fill(floor);
  for (const [bin, power] of Object.entries(peaks)) {
    bins[Number(bin)] = power;
  }
  return bins;
};

describe('PeakDetector', () => {
  it('returns no peaks for fewer than three bins', () => {
    const detector = new PeakDetector();
    expect(detector.detectPeaks([1, 2], 0, 1)).toEqual([]);
  });

  it('detects a clear peak above the noise floor', () => {
    const detector = new PeakDetector({ minSnrDb: 6, minPower: -100, minWidth: 1 });
    const bins = spectrum(64, -90, { 32: -40 });
    const peaks = detector.detectPeaks(bins, 100_000_000, 1_000);

    expect(peaks.length).toBe(1);
    expect(peaks[0].bin).toBe(32);
    expect(peaks[0].frequency).toBe(100_000_000 + 32 * 1_000);
    expect(peaks[0].snr).toBeGreaterThan(6);
  });

  it('ignores peaks that do not exceed the SNR threshold', () => {
    const detector = new PeakDetector({ minSnrDb: 20, minPower: -100, minWidth: 1 });
    const bins = spectrum(64, -90, { 32: -85 });
    expect(detector.detectPeaks(bins, 0, 1_000)).toEqual([]);
  });

  it('ignores peaks below the minimum absolute power', () => {
    const detector = new PeakDetector({ minSnrDb: 1, minPower: -50, minWidth: 1 });
    const bins = spectrum(64, -90, { 32: -60 });
    expect(detector.detectPeaks(bins, 0, 1_000)).toEqual([]);
  });

  it('excludes the DC bin by default', () => {
    const detector = new PeakDetector({ minSnrDb: 6, minPower: -100, minWidth: 1 });
    const bins = spectrum(64, -90, { 1: -40 });
    // bin 1 is the first scanned bin when excludeDc is true (loop starts at startBin+1=2),
    // so an isolated spike at bin 1 is not reported.
    const peaks = detector.detectPeaks(bins, 0, 1_000);
    expect(peaks.every((p) => p.bin !== 0)).toBe(true);
  });

  it('limits the number of returned peaks to maxPeaks ordered by SNR', () => {
    const detector = new PeakDetector({ minSnrDb: 6, minPower: -100, minWidth: 1, maxPeaks: 2 });
    const bins = spectrum(64, -90, { 10: -40, 20: -30, 30: -50, 40: -20 });
    const peaks = detector.detectPeaks(bins, 0, 1_000);
    expect(peaks).toHaveLength(2);
    // Strongest first: -20 (bin 40) then -30 (bin 20).
    expect(peaks[0].bin).toBe(40);
    expect(peaks[1].bin).toBe(20);
  });

  it('estimates the noise floor using the percentile method', () => {
    const detector = new PeakDetector({ noiseMethod: 'percentile', noisePercentile: 0.1 });
    const bins = spectrum(100, -95, { 50: -10 });
    expect(detector.getNoiseFloor(bins)).toBe(-95);
  });

  it('estimates the noise floor using the median method', () => {
    const detector = new PeakDetector({ noiseMethod: 'median' });
    expect(detector.getNoiseFloor([1, 2, 3, 4])).toBe(2.5);
    expect(detector.getNoiseFloor([1, 2, 3])).toBe(2);
  });

  it('estimates the noise floor using the min method', () => {
    const detector = new PeakDetector({ noiseMethod: 'min' });
    expect(detector.getNoiseFloor([-50, -90, -70])).toBe(-90);
  });

  it('tracks and smooths peaks across frames', () => {
    const detector = new PeakDetector({ minSnrDb: 6, minPower: -100, minWidth: 1 });
    const bins = spectrum(64, -90, { 32: -40 });
    detector.detectPeaks(bins, 100_000_000, 1_000);
    detector.detectPeaks(bins, 100_000_000, 1_000);

    const frequency = 100_000_000 + 32 * 1_000;
    const smoothed = detector.getSmoothedPeak(frequency);
    expect(smoothed).not.toBeNull();
    expect(smoothed?.frequency).toBeCloseTo(frequency);
  });

  it('returns null smoothed peak for an unknown frequency', () => {
    const detector = new PeakDetector();
    expect(detector.getSmoothedPeak(999_999_999)).toBeNull();
  });

  it('exposes and updates sensitivity settings', () => {
    const detector = new PeakDetector();
    detector.setSensitivity({ minSnrDb: 3, maxPeaks: 100 });
    const sensitivity = detector.getSensitivity();
    expect(sensitivity.minSnrDb).toBe(3);
    expect(sensitivity.maxPeaks).toBe(100);
  });

  it('clears history and last peaks', () => {
    const detector = new PeakDetector({ minSnrDb: 6, minPower: -100, minWidth: 1 });
    detector.detectPeaks(spectrum(64, -90, { 32: -40 }), 0, 1_000);
    expect(detector.getLastPeaks().length).toBeGreaterThan(0);
    detector.clearHistory();
    expect(detector.getLastPeaks()).toEqual([]);
  });
});
