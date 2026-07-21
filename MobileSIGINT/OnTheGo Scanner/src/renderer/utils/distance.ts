/**
 * Distance Unit Conversion Utilities
 * Converts distances between meters, miles, kilometers, and nautical miles
 */

export type DistanceUnit = 'miles' | 'kilometers' | 'nautical';

/**
 * Convert meters to the specified unit
 */
export function convertDistance(meters: number, toUnit: DistanceUnit): number {
  switch (toUnit) {
    case 'miles':
      return meters * 0.000621371;
    case 'kilometers':
      return meters * 0.001;
    case 'nautical':
      return meters * 0.000539957;
  }
}

/**
 * Convert kilometers to the specified unit
 */
export function convertDistanceFromKm(km: number, toUnit: DistanceUnit): number {
  switch (toUnit) {
    case 'miles':
      return km * 0.621371;
    case 'kilometers':
      return km;
    case 'nautical':
      return km * 0.539957;
  }
}

/**
 * Convert from a unit to meters
 */
export function toMeters(value: number, fromUnit: DistanceUnit): number {
  switch (fromUnit) {
    case 'miles':
      return value / 0.000621371;
    case 'kilometers':
      return value / 0.001;
    case 'nautical':
      return value / 0.000539957;
  }
}

/**
 * Format distance with appropriate unit suffix (input in meters)
 */
export function formatDistance(meters: number, unit: DistanceUnit, precision: number = 1): string {
  const value = convertDistance(meters, unit);
  const suffix = getUnitSuffix(unit);
  return `${value.toFixed(precision)} ${suffix}`;
}

/**
 * Format distance with appropriate unit suffix (input in kilometers)
 */
export function formatDistanceFromKm(
  km: number,
  unit: DistanceUnit,
  precision: number = 1,
): string {
  const value = convertDistanceFromKm(km, unit);
  const suffix = getUnitSuffix(unit);
  return `${value.toFixed(precision)} ${suffix}`;
}

/**
 * Get the short suffix for a distance unit
 */
export function getUnitSuffix(unit: DistanceUnit): string {
  switch (unit) {
    case 'miles':
      return 'mi';
    case 'kilometers':
      return 'km';
    case 'nautical':
      return 'nm';
  }
}

/**
 * Get the full name for a distance unit
 */
export function getUnitName(unit: DistanceUnit): string {
  switch (unit) {
    case 'miles':
      return 'Miles';
    case 'kilometers':
      return 'Kilometers';
    case 'nautical':
      return 'Nautical Miles';
  }
}
