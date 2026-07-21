import React from 'react';

import { useSelection } from '../../contexts/SelectionContext';
import { useDistanceUnit } from '../../hooks/useDistanceUnit';
import { formatDistanceFromKm } from '../../utils/distance';
import { formatTimeSince } from '../../utils/time';

import styles from './AircraftDetail.module.css';
import { useAircraft } from './hooks/useAircraft';

export const AircraftDetail: React.FC = () => {
  const aircraft = useAircraft();
  const { selectedAircraftIcao, isDetailPanelOpen, closeDetailPanel } = useSelection();
  const distanceUnit = useDistanceUnit();

  if (!isDetailPanelOpen || !selectedAircraftIcao) {
    return null;
  }

  const selected = aircraft.find((ac) => ac.icao === selectedAircraftIcao);

  if (!selected) {
    return (
      <aside className={styles.panel}>
        <div className={styles.header}>
          <h3>Aircraft not found</h3>
          <button type="button" className={styles.closeBtn} onClick={closeDetailPanel}>
            ✕
          </button>
        </div>
        <div className={styles.placeholder}>
          <p>This aircraft is no longer visible in the current telemetry frame.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <h3>{selected.callsign}</h3>
        <button type="button" className={styles.closeBtn} onClick={closeDetailPanel}>
          ✕
        </button>
      </div>
      <div className={styles.content}>
        <div className={styles.field}>
          <label>ICAO</label>
          <span>{selected.icao}</span>
        </div>
        <div className={styles.field}>
          <label>Altitude</label>
          <span>{selected.altitude.toLocaleString()} ft</span>
        </div>
        <div className={styles.field}>
          <label>Speed</label>
          <span>{selected.speed} kts</span>
        </div>
        <div className={styles.field}>
          <label>Heading</label>
          <span>{selected.heading}°</span>
        </div>
        {selected.verticalRate !== null && (
          <div className={styles.field}>
            <label>Vertical Rate</label>
            <span>
              {selected.verticalRate >= 0 ? '↑' : '↓'} {Math.abs(selected.verticalRate)} ft/min
            </span>
          </div>
        )}
        {selected.squawk && (
          <div className={styles.field}>
            <label>Squawk</label>
            <span>{selected.squawk}</span>
          </div>
        )}
        <div className={styles.field}>
          <label>Distance</label>
          <span>
            {selected.distance !== undefined
              ? formatDistanceFromKm(selected.distance, distanceUnit)
              : '—'}
          </span>
        </div>
        <div className={styles.field}>
          <label>Position</label>
          <span>
            {selected.lat.toFixed(4)}, {selected.lon.toFixed(4)}
          </span>
        </div>
        <div className={styles.field}>
          <label>Last Seen</label>
          <span>{formatTimeSince(selected.lastSeen)}</span>
        </div>
      </div>
    </aside>
  );
};
