/**
 * Shared formatting helpers for RF displays.
 */

export const formatFrequency = (hz: number): string => {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(2)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

export const formatPower = (db: number): string => `${db.toFixed(1)} dB`;
