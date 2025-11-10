/**
 * Advanced Peak Detection for RF Spectrum Analysis
 *
 * Implements robust peak detection with:
 * - Noise floor estimation
 * - SNR-based filtering
 * - Peak width measurement
 * - Peak tracking across frames
 * - Configurable thresholds
 *
 * @see RF_VISUALIZATION_PLAN.md
 */

export interface Peak {
  bin: number;
  frequency: number;
  power: number;
  snr: number;
  width: number;
}

export interface PeakDetectorOptions {
  /** Minimum SNR in dB above noise floor (default: 6) */
  minSnrDb?: number;

  /** Minimum absolute power in dB (default: -80) */
  minPower?: number;

  /** Minimum peak width in bins (default: 1) */
  minWidth?: number;

  /** Maximum number of peaks to return (default: 50) */
  maxPeaks?: number;

  /** Noise floor estimation method (default: 'percentile') */
  noiseMethod?: 'percentile' | 'median' | 'min';

  /** Percentile for noise estimation (default: 0.1 = 10th percentile) */
  noisePercentile?: number;

  /** Exclude DC bin (bin 0) from detection (default: true) */
  excludeDc?: boolean;
}

/**
 * Advanced peak detector with noise floor estimation and SNR filtering
 */
export class PeakDetector {
  private readonly minSnrDb: number;
  private readonly minPower: number;
  private readonly minWidth: number;
  private readonly maxPeaks: number;
  private readonly noiseMethod: 'percentile' | 'median' | 'min';
  private readonly noisePercentile: number;
  private readonly excludeDc: boolean;

  // Peak tracking for stability
  private lastPeaks: Peak[] = [];
  private peakHistory = new Map<number, Peak[]>(); // frequency -> recent peaks

  constructor(options: PeakDetectorOptions = {}) {
    this.minSnrDb = options.minSnrDb ?? 6;
    this.minPower = options.minPower ?? -80;
    this.minWidth = options.minWidth ?? 1;
    this.maxPeaks = options.maxPeaks ?? 50;
    this.noiseMethod = options.noiseMethod ?? 'percentile';
    this.noisePercentile = options.noisePercentile ?? 0.1;
    this.excludeDc = options.excludeDc ?? true;
  }

  /**
   * Detect peaks in spectrum bins
   */
  detectPeaks(bins: number[], startHz: number, binSizeHz: number): Peak[] {
    if (bins.length < 3) {
      return [];
    }

    // Estimate noise floor
    const noiseFloor = this.estimateNoiseFloor(bins);

    // Find candidate peaks
    const candidates: Peak[] = [];
    const startBin = this.excludeDc ? 1 : 0;

    for (let i = startBin + 1; i < bins.length - 1; i++) {
      const power = bins[i];

      // Check if local maximum
      if (power <= bins[i - 1] || power <= bins[i + 1]) {
        continue;
      }

      // Check SNR
      const snr = power - noiseFloor;
      if (snr < this.minSnrDb) {
        continue;
      }

      // Check absolute power
      if (power < this.minPower) {
        continue;
      }

      // Measure peak width at -3dB
      const width = this.measurePeakWidth(bins, i, power - 3);

      // Check minimum width
      if (width < this.minWidth) {
        continue;
      }

      const frequency = startHz + i * binSizeHz;

      candidates.push({
        bin: i,
        frequency,
        power,
        snr,
        width,
      });
    }

    // Sort by SNR (strongest first) and limit count
    const sortedPeaks = candidates.sort((a, b) => b.snr - a.snr).slice(0, this.maxPeaks);

    // Track for stability
    this.updatePeakTracking(sortedPeaks);

    this.lastPeaks = sortedPeaks;
    return sortedPeaks;
  }

  /**
   * Estimate noise floor using configured method
   */
  private estimateNoiseFloor(bins: number[]): number {
    if (bins.length === 0) {
      return -100;
    }

    switch (this.noiseMethod) {
      case 'percentile':
        return this.percentileNoiseFloor(bins, this.noisePercentile);

      case 'median':
        return this.medianNoiseFloor(bins);

      case 'min':
        return Math.min(...bins);

      default:
        return this.percentileNoiseFloor(bins, 0.1);
    }
  }

  /**
   * Noise floor as Nth percentile of power values
   */
  private percentileNoiseFloor(bins: number[], percentile: number): number {
    const sorted = [...bins].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * percentile);
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Noise floor as median of power values
   */
  private medianNoiseFloor(bins: number[]): number {
    const sorted = [...bins].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  /**
   * Measure peak width at specified threshold below peak
   */
  private measurePeakWidth(bins: number[], peakBin: number, threshold: number): number {
    let leftBin = peakBin;
    let rightBin = peakBin;

    // Expand left
    while (leftBin > 0 && bins[leftBin] > threshold) {
      leftBin--;
    }

    // Expand right
    while (rightBin < bins.length - 1 && bins[rightBin] > threshold) {
      rightBin++;
    }

    return rightBin - leftBin + 1;
  }

  /**
   * Update peak tracking for stability
   * Tracks peaks across frames to reduce flicker
   */
  private updatePeakTracking(peaks: Peak[]): void {
    // Add new peaks to history
    for (const peak of peaks) {
      const freqKey = Math.round(peak.frequency / 1000); // Round to kHz

      if (!this.peakHistory.has(freqKey)) {
        this.peakHistory.set(freqKey, []);
      }

      const history = this.peakHistory.get(freqKey)!;
      history.push({ ...peak });

      // Limit history length
      if (history.length > 10) {
        history.shift();
      }
    }

    // Clean old entries
    for (const [freq, history] of this.peakHistory.entries()) {
      if (history.length === 0) {
        this.peakHistory.delete(freq);
      }
    }
  }

  /**
   * Get smoothed peak from history
   * Returns average frequency/power over recent frames
   */
  getSmoothedPeak(frequency: number): Peak | null {
    const freqKey = Math.round(frequency / 1000);
    const history = this.peakHistory.get(freqKey);

    if (!history || history.length === 0) {
      return null;
    }

    // Average recent peaks
    const avgFrequency = history.reduce((sum, p) => sum + p.frequency, 0) / history.length;
    const avgPower = history.reduce((sum, p) => sum + p.power, 0) / history.length;
    const avgSnr = history.reduce((sum, p) => sum + p.snr, 0) / history.length;
    const avgWidth = history.reduce((sum, p) => sum + p.width, 0) / history.length;
    const avgBin = history.reduce((sum, p) => sum + p.bin, 0) / history.length;

    return {
      bin: Math.round(avgBin),
      frequency: avgFrequency,
      power: avgPower,
      snr: avgSnr,
      width: avgWidth,
    };
  }

  /**
   * Get last detected peaks
   */
  getLastPeaks(): Peak[] {
    return this.lastPeaks;
  }

  /**
   * Clear peak tracking history
   */
  clearHistory(): void {
    this.peakHistory.clear();
    this.lastPeaks = [];
  }

  /**
   * Get current noise floor estimate
   */
  getNoiseFloor(bins: number[]): number {
    return this.estimateNoiseFloor(bins);
  }
}
