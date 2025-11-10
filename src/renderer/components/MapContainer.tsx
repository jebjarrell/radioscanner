import React, { useEffect, useRef } from 'react';

import { useSelection } from '../contexts/SelectionContext';
import { useTelemetry } from '../contexts/TelemetryContext';
import { useDrones } from '../features/drone/hooks/useDrones';
import { useAppVersion } from '../hooks/useAppVersion';
import { MapPanel } from '../map/MapPanel';

export const MapContainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapPanelRef = useRef<MapPanel | null>(null);
  const version = useAppVersion();
  const { telemetry, connected } = useTelemetry();
  const { selectAircraft, selectDrone } = useSelection();
  const drones = useDrones();

  useEffect(() => {
    if (!containerRef.current || mapPanelRef.current) {
      return;
    }

    mapPanelRef.current = new MapPanel(containerRef.current, {
      version,
      onAircraftClick: (icao: string) => selectAircraft(icao),
      onDroneClick: (droneId: string) => selectDrone(droneId),
    });
    return () => {
      mapPanelRef.current?.dispose();
      mapPanelRef.current = null;
    };
  }, [version, selectAircraft, selectDrone]);

  useEffect(() => {
    if (mapPanelRef.current) {
      mapPanelRef.current.setVersion(version);
    }
  }, [version]);

  useEffect(() => {
    if (mapPanelRef.current) {
      mapPanelRef.current.setTelemetryConnected(connected);
    }
  }, [connected]);

  useEffect(() => {
    if (telemetry && mapPanelRef.current) {
      mapPanelRef.current.updateTelemetry(telemetry);
    }
  }, [telemetry]);

  useEffect(() => {
    if (mapPanelRef.current) {
      mapPanelRef.current.updateDrones(drones);
    }
  }, [drones]);

  return <div ref={containerRef} className="map-container" />;
};
