import { useEffect, useRef } from 'react';

import { useTelemetry } from '../contexts/TelemetryContext';
import { useToast } from '../contexts/ToastContext';
import { convertDistanceFromKm } from '../utils/distance';
import { haversineDistance } from '../utils/geo';

import { useSettings } from './useSettings';
import { useUserPosition } from './useUserPosition';

/**
 * Notification Hook
 * Monitors telemetry for events and triggers notifications based on user settings
 */
export function useNotifications(): void {
  const { telemetry } = useTelemetry();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const userPosition = useUserPosition();

  // Track previous state to detect changes
  const prevDroneIdsRef = useRef<Set<string>>(new Set());
  const prevRtlTcpConnectedRef = useRef<boolean | null>(null);
  const prevGpsConnectedRef = useRef<boolean | null>(null);
  const notifiedAircraftRef = useRef<Set<string>>(new Set());

  // Notification settings
  const notifSettings = settings?.notifications;
  const enabled = notifSettings?.enabled ?? true;
  const droneDetectedEnabled = notifSettings?.droneDetected ?? true;
  const aircraftProximityEnabled = notifSettings?.aircraftProximity ?? false;
  const newSignalEnabled = notifSettings?.newSignal ?? true;
  const duration = notifSettings?.duration ?? 4000;
  const proximityThresholdMiles = notifSettings?.aircraftProximityThresholdMiles ?? 5;

  // Convert proximity threshold from miles to kilometers (haversine returns km)
  const proximityThresholdKm = proximityThresholdMiles / 0.621371;

  // Monitor drone detections
  useEffect(() => {
    if (!enabled || !droneDetectedEnabled || !telemetry) {
      return;
    }

    const currentDroneIds = new Set<string>();
    const drones = telemetry.drone?.detections || [];

    // Collect current drone IDs
    for (const drone of drones) {
      const id = drone.droneId || 'unknown';
      currentDroneIds.add(id);

      // Check if this is a new drone
      if (!prevDroneIdsRef.current.has(id)) {
        const manufacturer = drone.manufacturer || 'Unknown';
        const model = drone.model || 'Unknown';

        showToast(`Drone Detected: ${manufacturer} ${model}`, 'info', duration);
      }
    }

    prevDroneIdsRef.current = currentDroneIds;
  }, [telemetry, enabled, droneDetectedEnabled, showToast, duration]);

  // Monitor aircraft proximity
  useEffect(() => {
    if (!enabled || !aircraftProximityEnabled || !telemetry) {
      return;
    }

    const aircraft = telemetry.aircraft || [];

    for (const ac of aircraft) {
      if (!ac.hex || ac.lat == null || ac.lon == null) {
        continue;
      }

      // Calculate distance using haversine utility
      const distanceKm = haversineDistance(userPosition.lat, userPosition.lon, ac.lat, ac.lon);

      // Check if within threshold and not already notified
      if (distanceKm <= proximityThresholdKm && !notifiedAircraftRef.current.has(ac.hex)) {
        const distanceMiles = convertDistanceFromKm(distanceKm, 'miles');
        const flight = ac.flight?.trim() || ac.hex;

        showToast(`Aircraft ${flight} within ${distanceMiles.toFixed(1)} mi`, 'warning', duration);

        notifiedAircraftRef.current.add(ac.hex);
      }

      // Remove from notified set if aircraft moves out of range
      if (distanceKm > proximityThresholdKm) {
        notifiedAircraftRef.current.delete(ac.hex);
      }
    }
  }, [
    telemetry,
    enabled,
    aircraftProximityEnabled,
    showToast,
    duration,
    proximityThresholdKm,
    userPosition,
  ]);

  // Monitor signal connection changes
  useEffect(() => {
    if (!enabled || !newSignalEnabled || !telemetry) {
      return;
    }

    const rtlTcpConnected = telemetry.signals?.rtlTcpConnected ?? false;
    const gpsConnected = telemetry.signals?.gpsConnected ?? false;

    // Check RTL-TCP connection status change
    if (prevRtlTcpConnectedRef.current !== null) {
      if (rtlTcpConnected !== prevRtlTcpConnectedRef.current) {
        if (rtlTcpConnected) {
          showToast('RTL-TCP Connected', 'success', duration);
        } else {
          showToast('RTL-TCP Disconnected', 'error', duration);
        }
      }
    }
    prevRtlTcpConnectedRef.current = rtlTcpConnected;

    // Check GPS connection status change
    if (prevGpsConnectedRef.current !== null) {
      if (gpsConnected !== prevGpsConnectedRef.current) {
        if (gpsConnected) {
          showToast('GPS Connected', 'success', duration);
        } else {
          showToast('GPS Disconnected', 'error', duration);
        }
      }
    }
    prevGpsConnectedRef.current = gpsConnected;
  }, [telemetry, enabled, newSignalEnabled, showToast, duration]);
}
