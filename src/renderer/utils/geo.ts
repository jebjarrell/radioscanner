const EARTH_RADIUS_KM = 6_371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function formatDistance(distanceKm: number, unit: 'km' | 'mi' = 'mi'): string {
  const value = unit === 'mi' ? distanceKm * 0.621371 : distanceKm;
  return `${value.toFixed(1)} ${unit}`;
}
