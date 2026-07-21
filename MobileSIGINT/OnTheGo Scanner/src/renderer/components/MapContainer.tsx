import React, { useEffect, useRef } from 'react';

import { useSelection } from '../contexts/SelectionContext';
import { useTelemetry } from '../contexts/TelemetryContext';
import { useDrones } from '../features/drone/hooks/useDrones';
import { useAppVersion } from '../hooks/useAppVersion';
import { useSettings } from '../hooks/useSettings';
import { MapPanel } from '../map/MapPanel';

export const MapContainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapPanelRef = useRef<MapPanel | null>(null);
  const version = useAppVersion();
  const { telemetry, connected, isFromCache, cacheTimestamp } = useTelemetry();
  const { selectAircraft, selectDrone } = useSelection();
  const drones = useDrones();
  const { settings } = useSettings();

  useEffect(() => {
    if (!containerRef.current || mapPanelRef.current) {
      return;
    }

    const mapStyleId = settings?.preferences?.mapStyle || 'demotiles';

    mapPanelRef.current = new MapPanel(containerRef.current, {
      version,
      mapStyleId,
      onAircraftClick: (icao: string) => selectAircraft(icao),
      onDroneClick: (droneId: string) => selectDrone(droneId),
    });
    return () => {
      if (mapPanelRef.current) {
        mapPanelRef.current.dispose();
        mapPanelRef.current = null;
      }
    };
  }, [version, selectAircraft, selectDrone, settings]);

  useEffect(() => {
    if (mapPanelRef.current) {
      mapPanelRef.current.setVersion(version);
    }
  }, [version]);

  useEffect(() => {
    if (mapPanelRef.current && settings?.preferences?.mapStyle) {
      mapPanelRef.current.setMapStyle(settings.preferences.mapStyle);
    }
  }, [settings?.preferences?.mapStyle]);

  useEffect(() => {
    if (mapPanelRef.current) {
      mapPanelRef.current.setTelemetryConnected(connected, isFromCache, cacheTimestamp);
    }
  }, [connected, isFromCache, cacheTimestamp]);

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
