import { LAT_MAX, LAT_MIN, LON_MAX, LON_MIN } from './constants.js';
const state = {
  gpsManualFallback: {
    enabled: false,
    lat: null,
    lon: null,
    updatedAt: null,
  },
};
export function getManualGpsFallback() {
  return { ...state.gpsManualFallback };
}
export function setManualGpsFallback(input) {
  const fallback = state.gpsManualFallback;
  if (typeof input.enabled === 'boolean') {
    fallback.enabled = input.enabled;
  }
  let updated = false;
  if ('lat' in input) {
    if (input.lat === null) {
      fallback.lat = null;
      updated = true;
    } else if (typeof input.lat === 'number' && Number.isFinite(input.lat)) {
      fallback.lat = clamp(input.lat, LAT_MIN, LAT_MAX);
      updated = true;
    }
  }
  if ('lon' in input) {
    if (input.lon === null) {
      fallback.lon = null;
      updated = true;
    } else if (typeof input.lon === 'number' && Number.isFinite(input.lon)) {
      fallback.lon = clamp(input.lon, LON_MIN, LON_MAX);
      updated = true;
    }
  }
  if (updated) {
    fallback.updatedAt = typeof input.updatedAt === 'number' ? input.updatedAt : Date.now();
  }
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
