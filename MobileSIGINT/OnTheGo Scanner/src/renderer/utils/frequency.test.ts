import { describe, expect, it } from 'vitest';

import { formatFrequency, formatPower } from './frequency';

describe('formatFrequency', () => {
  it('formats GHz values', () => {
    expect(formatFrequency(2.4e9)).toBe('2.40 GHz');
  });

  it('formats MHz values', () => {
    expect(formatFrequency(118e6)).toBe('118.00 MHz');
    expect(formatFrequency(915e6)).toBe('915.00 MHz');
  });

  it('formats kHz values', () => {
    expect(formatFrequency(455e3)).toBe('455.0 kHz');
  });

  it('formats Hz values', () => {
    expect(formatFrequency(60)).toBe('60 Hz');
  });

  it('handles zero', () => {
    expect(formatFrequency(0)).toBe('0 Hz');
  });
});

describe('formatPower', () => {
  it('formats dB with one decimal', () => {
    expect(formatPower(-42.34)).toBe('-42.3 dB');
    expect(formatPower(0)).toBe('0.0 dB');
  });
});
