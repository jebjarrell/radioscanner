import React from 'react';

import { useSelection } from '../../contexts/SelectionContext';
import { formatDistance } from '../../utils/geo';
import { formatTimeSince } from '../../utils/time';
import { BACKEND_URL } from '../../../config/client.js';

import styles from './DroneDetail.module.css';
import { useDrones } from './hooks/useDrones';

export const DroneDetail: React.FC = () => {
  const drones = useDrones();
  const { selectedDroneId, isDetailPanelOpen, closeDetailPanel } = useSelection();

  if (!isDetailPanelOpen || !selectedDroneId) {
    return null;
  }

  const drone = drones.find((entry) => entry.droneId === selectedDroneId);
  if (!drone) {
    return (
      <aside className={styles.panel}>
        <div className={styles.header}>
          <h3>Drone Not Found</h3>
          <button type="button" className={styles.closeBtn} onClick={closeDetailPanel}>
            ✕
          </button>
        </div>
        <div className={styles.content}>
          <p>This drone is no longer visible in the current telemetry frame.</p>
        </div>
      </aside>
    );
  }

  const handleExport = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/export/drone/${encodeURIComponent(drone.droneId)}`,
      );
      if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `drone_${drone.droneId}_${Date.now()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export drone log', err);
    }
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <h3>
          {drone.manufacturer || 'Drone'} — {drone.model || drone.droneId}
        </h3>
        <button type="button" className={styles.closeBtn} onClick={closeDetailPanel}>
          ✕
        </button>
      </div>
      <div className={styles.content}>
        <div className={styles.field}>
          <span className={styles.label}>Drone ID:</span>
          <span className={styles.value}>{drone.droneId}</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Position:</span>
          <span className={styles.value}>
            {drone.droneLat != null ? drone.droneLat.toFixed(5) : '—'},{' '}
            {drone.droneLon != null ? drone.droneLon.toFixed(5) : '—'}
          </span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Altitude (MSL):</span>
          <span className={styles.value}>{drone.droneAltitude ?? '—'} m</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Speed:</span>
          <span className={styles.value}>{drone.speed ?? '—'} m/s</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Heading:</span>
          <span className={styles.value}>{drone.heading ?? '—'}°</span>
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Operator:</span>
          {drone.operatorLat != null && drone.operatorLon != null ? (
            <span className={styles.value}>
              {drone.operatorLat.toFixed(5)}, {drone.operatorLon.toFixed(5)}
              {drone.distance != null ? ` (${formatDistance(drone.distance)} away)` : ''}
            </span>
          ) : (
            <span className={styles.unavailable}>Unknown (not in Remote ID broadcast)</span>
          )}
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Last Update:</span>
          <span className={styles.value}>{formatTimeSince(drone.lastSeen)}</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.exportBtn} onClick={handleExport}>
            📥 Export Drone Log
          </button>
        </div>
      </div>
    </aside>
  );
};
