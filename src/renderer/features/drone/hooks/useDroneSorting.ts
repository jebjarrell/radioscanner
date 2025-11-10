import { useMemo, useState } from 'react';

import type { Drone, DroneSortKey, SortDirection } from '../types.js';

export const useDroneSorting = (drones: Drone[]) => {
  const [sortKey, setSortKey] = useState<DroneSortKey>('distance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sorted = useMemo(() => {
    const copy = [...drones];
    copy.sort((a, b) => {
      const pick = (
        key: DroneSortKey,
        left: Drone,
        right: Drone,
      ): [number | string, number | string] => {
        switch (key) {
          case 'droneId':
            return [left.droneId.toLowerCase(), right.droneId.toLowerCase()];
          case 'manufacturer':
            return [
              (left.manufacturer ?? '').toLowerCase(),
              (right.manufacturer ?? '').toLowerCase(),
            ];
          case 'altitude':
            return [left.droneAltitude ?? -1, right.droneAltitude ?? -1];
          case 'distance':
          default:
            return [
              left.distance ?? Number.POSITIVE_INFINITY,
              right.distance ?? Number.POSITIVE_INFINITY,
            ];
        }
      };
      const [aValue, bValue] = pick(sortKey, a, b);
      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return copy;
  }, [drones, sortDirection, sortKey]);

  const toggleSort = (key: DroneSortKey) => {
    if (key === sortKey) {
      setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return {
    sorted,
    sortKey,
    sortDirection,
    toggleSort,
  };
};
