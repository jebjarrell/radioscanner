import { afterEach, describe, expect, it, vi } from 'vitest';

import { PsdEngine, type SpectrumFrame } from './psdEngine.js';

const FFT_SIZE = 64;
const SAMPLE_RATE = 2_048_000;
const CENTER_HZ = 100_000_000;

/** Build an IQ byte buffer (interleaved I/Q, 8-bit) of the given sample count. */
const makeIq = (samples: number): Uint8Array => {
  const iq = new Uint8Array(samples * 2);
  for (let i = 0; i < samples; i++) {
    // A simple tone so the FFT has structure; values centered around 127.5.
    iq[i * 2] = 127 + Math.round(40 * Math.sin((2 * Math.PI * i) / 8));
    iq[i * 2 + 1] = 127 + Math.round(40 * Math.cos((2 * Math.PI * i) / 8));
  }
  return iq;
};

describe('PsdEngine', () => {
  it('ignores IQ buffers that are too small', () => {
    const engine = new PsdEngine({ fftSize: FFT_SIZE, frameRateHz: 5, sampleRate: SAMPLE_RATE });
    const onSpectrum = vi.fn();
    engine.on('spectrum', onSpectrum);

    engine.pushIq(makeIq(FFT_SIZE - 1), CENTER_HZ);
    expect(onSpectrum).not.toHaveBeenCalled();
  });

  it('emits a spectrum frame with the expected shape', () => {
    const engine = new PsdEngine({
      fftSize: FFT_SIZE,
      frameRateHz: 5,
      sampleRate: SAMPLE_RATE,
      avgFrames: 1,
    });
    let frame: SpectrumFrame | null = null;
    engine.on('spectrum', (f) => {
      frame = f;
    });

    engine.pushIq(makeIq(FFT_SIZE), CENTER_HZ);

    expect(frame).not.toBeNull();
    const emitted = frame as unknown as SpectrumFrame;
    expect(emitted.bins).toHaveLength(FFT_SIZE);
    expect(emitted.startHz).toBe(CENTER_HZ - SAMPLE_RATE / 2);
    expect(emitted.binSizeHz).toBe(SAMPLE_RATE / FFT_SIZE);
    expect(typeof emitted.ts).toBe('number');
    expect(emitted.bins.every((b) => Number.isFinite(b))).toBe(true);
  });

  it('averages multiple frames before emitting when avgFrames > 1', () => {
    // Freeze time so the frame-rate gate stays closed and only the
    // averaging counter controls when a frame is emitted.
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const engine = new PsdEngine({
      fftSize: FFT_SIZE,
      frameRateHz: 1, // minInterval = 1000ms; with frozen time the gate stays closed
      sampleRate: SAMPLE_RATE,
      avgFrames: 3,
    });
    const onSpectrum = vi.fn();
    engine.on('spectrum', onSpectrum);

    // Advance past the initial lastEmit (0) so the first push is gated by avgFrames.
    engine.pushIq(makeIq(FFT_SIZE), CENTER_HZ); // emits first frame (lastEmit was 0)
    onSpectrum.mockClear();

    engine.pushIq(makeIq(FFT_SIZE), CENTER_HZ);
    engine.pushIq(makeIq(FFT_SIZE), CENTER_HZ);
    expect(onSpectrum).not.toHaveBeenCalled();

    engine.pushIq(makeIq(FFT_SIZE), CENTER_HZ);
    expect(onSpectrum).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
