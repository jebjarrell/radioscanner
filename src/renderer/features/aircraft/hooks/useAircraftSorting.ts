import { useMemo, useState } from 'react';

import type { Aircraft, SortDirection, SortKey } from '../types';

const compareStrings = (a: string, b: string): number => a.localeCompare(b);

export const useAircraftSorting = (aircraft: Aircraft[]) => {
  const [sortKey, setSortKey] = useState<SortKey>('distance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedAircraft = useMemo(() => {
    const sorted = [...aircraft];

    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'callsign':
          comparison = compareStrings(a.callsign.toLowerCase(), b.callsign.toLowerCase());
          break;
        case 'distance':
          comparison =
            (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY);
          break;
        case 'altitude':
          comparison = a.altitude - b.altitude;
          break;
        case 'speed':
          comparison = a.speed - b.speed;
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [aircraft, sortKey, sortDirection]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return { sortedAircraft, sortKey, sortDirection, toggleSort };
};
