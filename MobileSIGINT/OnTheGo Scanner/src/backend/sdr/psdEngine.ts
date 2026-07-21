import FFT from 'fft.js';

import { TypedEventEmitter } from '../utils/typedEventEmitter.js';

export interface PsdConfig {
  fftSize: number;
  frameRateHz: number;
  sampleRate: number;
  avgFrames?: number;
}

export type SpectrumFrame = {
  startHz: number;
  binSizeHz: number;
  bins: number[];
  ts: number;
};

type PsdEvents = {
  spectrum: (frame: SpectrumFrame) => void;
};

export class PsdEngine extends TypedEventEmitter<PsdEvents> {
  private readonly fft: FFT;
  private readonly input: Float32Array;
  private readonly out: Float32Array;
  private readonly avgSum: Float32Array;
  private avgCount = 0;
  private lastEmit = 0;

  constructor(private readonly cfg: PsdConfig) {
    super();
    this.fft = new FFT(cfg.fftSize);
    this.input = new Float32Array(cfg.fftSize * 2);
    this.out = new Float32Array(cfg.fftSize * 2);
    this.avgSum = new Float32Array(cfg.fftSize);
  }

  pushIq(iq: Uint8Array, centerHz: number): void {
    const { fftSize, frameRateHz, sampleRate } = this.cfg;
    if (iq.length < fftSize * 2) {
      return;
    }

    const now = Date.now();
    const minInterval = 1_000 / frameRateHz;

    for (let i = 0; i < fftSize; i++) {
      const real = iq[i * 2] - 127.5;
      const imag = iq[i * 2 + 1] - 127.5;
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      this.input[i * 2] = (real / 127.5) * window;
      this.input[i * 2 + 1] = (imag / 127.5) * window;
    }

    this.fft.transform(this.out, this.input);

    const half = fftSize / 2;
    const shifted = new Float32Array(fftSize);
    for (let k = 0; k < fftSize; k++) {
      const re = this.out[k * 2];
      const im = this.out[k * 2 + 1];
      const pwr = re * re + im * im;
      const db = 10 * Math.log10(pwr + 1e-12);
      const idx = (k + half) % fftSize;
      shifted[idx] = db;
    }

    for (let i = 0; i < fftSize; i++) {
      this.avgSum[i] += shifted[i];
    }
    this.avgCount += 1;

    const targetAvg = this.cfg.avgFrames ?? 1;
    if (now - this.lastEmit < minInterval && this.avgCount < targetAvg) {
      return;
    }

    const bins: number[] = new Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      bins[i] = this.avgSum[i] / this.avgCount;
      this.avgSum[i] = 0;
    }
    this.avgCount = 0;
    this.lastEmit = now;

    const frame: SpectrumFrame = {
      startHz: centerHz - sampleRate / 2,
      binSizeHz: sampleRate / fftSize,
      bins,
      ts: now,
    };
    this.emit('spectrum', frame);
  }
}
