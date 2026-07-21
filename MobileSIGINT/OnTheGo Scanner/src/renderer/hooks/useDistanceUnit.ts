import { useMemo } from 'react';

import type { DistanceUnit } from '../utils/distance';

import { useSettings } from './useSettings';

/**
 * Hook to get the user's preferred distance unit from settings
 */
export function useDistanceUnit(): DistanceUnit {
  const { settings } = useSettings();

  return useMemo(() => {
    const unit = settings?.preferences?.distanceUnit;
    if (unit === 'kilometers' || unit === 'nautical') {
      return unit;
    }
    return 'miles'; // default fallback
  }, [settings]);
}
