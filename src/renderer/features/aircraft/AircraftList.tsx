import React, { useMemo } from 'react';

import { useSelection } from '../../contexts/SelectionContext';
import { formatDistance } from '../../utils/geo';
import { formatTimeSince, isStale } from '../../utils/time';
import { useAircraft } from './hooks/useAircraft';
import { useAircraftSorting } from './hooks/useAircraftSorting';
import type { SortKey } from './types';
import styles from './AircraftList.module.css';

const SortHeader: React.FC<{
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: 'asc' | 'desc';
  onToggle: (key: SortKey) => void;
}> = ({ label, sortKey, activeKey, direction, onToggle }) => {
  const indicator = useMemo(() => {
    if (activeKey !== sortKey) {
      return null;
    }
    return <span className={styles.sortIndicator}>{direction === 'asc' ? '▲' : '▼'}</span>;
  }, [activeKey, direction, sortKey]);

  return (
    <th role="columnheader" className={styles.sortable} onClick={() => onToggle(sortKey)}>
      {label}
      {indicator}
    </th>
  );
};

export const AircraftList: React.FC = () => {
  const aircraft = useAircraft();
  const { sortedAircraft, sortKey, sortDirection, toggleSort } = useAircraftSorting(aircraft);
  const { selectedAircraftIcao, selectAircraft } = useSelection();

  if (!aircraft.length) {
    return (
      <div className={styles.empty}>
        <p>No aircraft detected</p>
        <p className={styles.hint}>Waiting for ADS-B telemetry…</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <SortHeader
              label="Callsign"
              sortKey="callsign"
              activeKey={sortKey}
              direction={sortDirection}
              onToggle={toggleSort}
            />
            <SortHeader
              label="Distance"
              sortKey="distance"
              activeKey={sortKey}
              direction={sortDirection}
              onToggle={toggleSort}
            />
            <SortHeader
              label="Altitude"
              sortKey="altitude"
              activeKey={sortKey}
              direction={sortDirection}
              onToggle={toggleSort}
            />
            <SortHeader
              label="Speed"
              sortKey="speed"
              activeKey={sortKey}
              direction={sortDirection}
              onToggle={toggleSort}
            />
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {sortedAircraft.map((ac) => {
            const selected = ac.icao === selectedAircraftIcao;
            return (
              <tr
                key={ac.icao}
                className={[
                  styles.row,
                  selected ? styles.selected : '',
                  isStale(ac.lastSeen, 60) ? styles.stale : '',
                ].join(' ')}
                onClick={() => selectAircraft(ac.icao)}
              >
                <td>{ac.callsign}</td>
                <td>{ac.distance !== undefined ? formatDistance(ac.distance) : '—'}</td>
                <td>{ac.altitude.toLocaleString()} ft</td>
                <td>{ac.speed} kts</td>
                <td className={styles.lastSeen}>{formatTimeSince(ac.lastSeen)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
