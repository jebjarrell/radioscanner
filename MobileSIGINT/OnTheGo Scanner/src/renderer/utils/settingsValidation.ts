/**
 * Client-side validation for settings updates before they are sent to the
 * backend. Keys not covered here pass through untouched so newer backends can
 * introduce settings without breaking older clients.
 */

// Hostname or IPv4/IPv6-ish: letters, digits, dots, hyphens, colons (IPv6)
const HOST_PATTERN = /^[a-zA-Z0-9.:-]+$/;

const ENUM_RULES: Record<string, readonly string[]> = {
  'preferences.distanceUnit': ['miles', 'kilometers', 'nautical'],
  'preferences.mapStyle': ['demotiles', 'osm', 'dark', 'satellite'],
  'notifications.position': ['top-right', 'top-left', 'bottom-right', 'bottom-left'],
  'performance.peakDetectionSensitivity': ['low', 'medium', 'high'],
  'session.storageMode': ['memory', 'disk'],
};

const RANGE_RULES: Record<string, { min: number; max: number; label: string }> = {
  'preferences.mapDefaultCenterLat': { min: -90, max: 90, label: 'Map center latitude' },
  'preferences.mapDefaultCenterLon': { min: -180, max: 180, label: 'Map center longitude' },
  'preferences.mapDefaultZoom': { min: 1, max: 20, label: 'Map zoom' },
  'notifications.aircraftProximityThresholdMiles': {
    min: 1,
    max: 50,
    label: 'Proximity threshold',
  },
  'notifications.duration': { min: 1000, max: 10000, label: 'Toast duration' },
  'performance.waterfallMaxRows': { min: 40, max: 200, label: 'Waterfall rows' },
  'performance.maxAircraftDisplayed': { min: 40, max: 200, label: 'Max aircraft' },
  'performance.telemetryUpdateInterval': { min: 500, max: 5000, label: 'Update interval' },
};

/**
 * Validate a batch of pending setting changes.
 * @returns Human-readable error messages; empty when everything is valid.
 */
export function validateSettingUpdates(updates: Record<string, string>): string[] {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key.startsWith('services.') && key.endsWith('Host')) {
      if (!value || !HOST_PATTERN.test(value)) {
        errors.push(`${key.replace('services.', '')}: enter a valid hostname or IP address`);
      }
      continue;
    }

    if (key.startsWith('services.') && key.endsWith('Port')) {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        errors.push(`${key.replace('services.', '')}: port must be 1-65535`);
      }
      continue;
    }

    const allowed = ENUM_RULES[key];
    if (allowed) {
      if (!allowed.includes(value)) {
        errors.push(`${key}: must be one of ${allowed.join(', ')}`);
      }
      continue;
    }

    const range = RANGE_RULES[key];
    if (range) {
      const num = Number(value);
      if (!Number.isFinite(num) || num < range.min || num > range.max) {
        errors.push(`${range.label}: must be between ${range.min} and ${range.max}`);
      }
    }
  }

  return errors;
}
