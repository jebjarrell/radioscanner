import React from 'react';

import { useSelection } from '../../contexts/SelectionContext';
import { useTelemetry } from '../../contexts/TelemetryContext';
import { useDistanceUnit } from '../../hooks/useDistanceUnit';
import { formatDistanceFromKm } from '../../utils/distance';
import { formatTimeSince } from '../../utils/time';

import styles from './DroneList.module.css';
import { useDrones } from './hooks/useDrones';
import { useDroneSorting } from './hooks/useDroneSorting';
import type { DroneSortKey } from './types';

const SortHeader: React.FC<{
  label: string;
  sortKey: DroneSortKey;
  activeKey: DroneSortKey;
  direction: 'asc' | 'desc';
  onToggle: (key: DroneSortKey) => void;
}> = ({ label, sortKey, activeKey, direction, onToggle }) => (
  <th onClick={() => onToggle(sortKey)} className={styles.sortable} role="columnheader">
    {label}
    {activeKey === sortKey && (direction === 'asc' ? ' ▲' : ' ▼')}
  </th>
);

export const DroneList: React.FC = () => {
  const { telemetry } = useTelemetry();
  const ridAvailable = telemetry?.drone?.ridAvailable ?? true;
  const drones = useDrones();
  const { sorted, sortKey, sortDirection, toggleSort } = useDroneSorting(drones);
  const { selectedDroneId, selectDrone } = useSelection();
  const distanceUnit = useDistanceUnit();

  if (!ridAvailable) {
    return (
      <div className={styles.unavailable}>
        <h3>Remote ID Unavailable</h3>
        <p>Kismet service is not detecting Remote ID broadcasts.</p>
        <p className={styles.hint}>
          Ensure Kismet is running and configured for Bluetooth monitoring.
        </p>
      </div>
    );
  }

  if (!sorted.length) {
    return (
      <div className={styles.empty}>
        <p>No drones detected</p>
        <p className={styles.hint}>Waiting for Remote ID…</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <SortHeader
              label="Drone ID"
              sortKey="droneId"
              activeKey={sortKey}
              direction={sortDirection}
              onToggle={toggleSort}
            />
            <SortHeader
              label="Manufacturer"
              sortKey="manufacturer"
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
              label="Altitude (m)"
              sortKey="altitude"
              activeKey={sortKey}
              direction={sortDirection}
              onToggle={toggleSort}
            />
            <th>Last Seen</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((drone) => (
            <tr
              key={drone.droneId}
              className={`${styles.row} ${selectedDroneId === drone.droneId ? styles.selected : ''}`}
              onClick={() => selectDrone(drone.droneId)}
            >
              <td>{drone.droneId}</td>
              <td>{drone.manufacturer ?? '—'}</td>
              <td>
                {drone.distance != null ? formatDistanceFromKm(drone.distance, distanceUnit) : '—'}
              </td>
              <td>{drone.droneAltitude ?? '—'}</td>
              <td>{formatTimeSince(drone.lastSeen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
