import React, { useEffect, useState } from 'react';

import { useTelemetry } from '../contexts/TelemetryContext';
import { useAircraft } from '../features/aircraft/hooks/useAircraft';
import { useDrones } from '../features/drone/hooks/useDrones';
import { RF_BANDS, RF_BAND_OPTIONS, type RfBandKey } from '../features/rf/bands';
import { useSignals } from '../hooks/useSignals';

import { SettingsPanel } from './SettingsPanel';

const COMMERCIAL_REGEX = /^[A-Z]{3}\d{1,4}$/;

const determineSignalBand = (frequencyMHz: number): string => {
  if (frequencyMHz >= 118 && frequencyMHz <= 136) return 'Airband';
  if (frequencyMHz >= 156 && frequencyMHz <= 162) return 'Marine';
  if (frequencyMHz >= 160 && frequencyMHz <= 162) return 'Rail';
  if (frequencyMHz >= 462 && frequencyMHz < 465) return 'GMRS';
  if (frequencyMHz >= 465 && frequencyMHz <= 468) return 'FRS';
  return 'Other';
};

export const DashboardCounters: React.FC = () => {
  const { telemetry } = useTelemetry();
  const aircraft = useAircraft();
  const drones = useDrones();
  const signals = useSignals();

  const [activeBand, setActiveBand] = useState<RfBandKey>('airband');
  const [scanning, setScanning] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  useEffect(() => {
    const rtlOnline = telemetry?.signals?.rtlTcpConnected ?? false;
    if (!rtlOnline) {
      setScanning(false);
    }
  }, [telemetry?.signals?.rtlTcpConnected]);

  const now = Date.now();

  const recentAircraft = aircraft.filter((item) => now - item.lastSeen <= 60_000);
  const commercialCount = recentAircraft.filter((item) =>
    COMMERCIAL_REGEX.test(item.callsign ?? ''),
  ).length;
  const privateCount = Math.max(0, recentAircraft.length - commercialCount);

  const recentDrones = drones.filter((item) => now - item.lastSeen <= 30_000);
  const droneCounts = new Map<string, number>();
  recentDrones.forEach((drone) => {
    const manufacturer = (drone.manufacturer ?? 'Unknown').trim() || 'Unknown';
    droneCounts.set(manufacturer, (droneCounts.get(manufacturer) ?? 0) + 1);
  });
  const droneBreakdown = Array.from(droneCounts.entries()).sort((a, b) => b[1] - a[1]);

  const recentSignals = signals.filter((item) => now - item.ts <= 10_000);
  const signalCounts = new Map<string, number>();
  recentSignals.forEach((signal) => {
    const band = determineSignalBand(signal.frequency);
    signalCounts.set(band, (signalCounts.get(band) ?? 0) + 1);
  });
  const signalBreakdown = Array.from(signalCounts.entries()).sort((a, b) => b[1] - a[1]);

  const handleScanToggle = async () => {
    setScanBusy(true);
    try {
      if (scanning) {
        const response = await fetch('http://127.0.0.1:3000/api/scan/stop', { method: 'POST' });
        if (!response.ok) {
          throw new Error(`Stop failed: ${response.status}`);
        }
        setScanning(false);
      } else {
        const preset = RF_BANDS[activeBand];
        const response = await fetch('http://127.0.0.1:3000/api/scan/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            band: activeBand,
            centerHz: preset.centerHz,
            sampleRate: preset.sampleRate,
            spanHz: preset.spanHz,
          }),
        });
        if (!response.ok) {
          throw new Error(`Start failed: ${response.status}`);
        }
        setScanning(true);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[rf] scan toggle failed', err);
      }
    } finally {
      setScanBusy(false);
    }
  };

  return (
    <div className="dashboard-counters">
      <section className="dashboard-card">
        <header className="dashboard-card__header">
          <h3>Aircraft (last 60s)</h3>
          <span className="dashboard-card__metric">{recentAircraft.length}</span>
        </header>
        <ul className="dashboard-card__breakdown">
          <li>
            <span>Commercial</span>
            <span>{commercialCount}</span>
          </li>
          <li>
            <span>Private</span>
            <span>{privateCount}</span>
          </li>
        </ul>
      </section>

      <section className="dashboard-card">
        <header className="dashboard-card__header">
          <h3>Drones (last 30s)</h3>
          <span className="dashboard-card__metric">{recentDrones.length}</span>
        </header>
        {recentDrones.length === 0 ? (
          <div className="dashboard-card__empty">No drones detected</div>
        ) : (
          <ul className="dashboard-card__breakdown">
            {droneBreakdown.map(([manufacturer, count]) => (
              <li key={manufacturer}>
                <span>{manufacturer}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-card">
        <header className="dashboard-card__header">
          <h3>RF Signals (last 10s)</h3>
          <span className="dashboard-card__metric">{recentSignals.length}</span>
        </header>
        {recentSignals.length === 0 ? (
          <div className="dashboard-card__empty">No signals detected</div>
        ) : (
          <ul className="dashboard-card__breakdown">
            {signalBreakdown.map(([band, count]) => (
              <li key={band}>
                <span>{band}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dashboard-card dashboard-card--controls">
        <header className="dashboard-card__header">
          <h3>Quick RF Controls</h3>
        </header>
        <div className="dashboard-card__control-row">
          <label htmlFor="dashboard-band">Active Band</label>
          <select
            id="dashboard-band"
            value={activeBand}
            onChange={(event) => setActiveBand(event.target.value as RfBandKey)}
          >
            {RF_BAND_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleScanToggle} disabled={scanBusy}>
            {scanning ? 'Stop Scan' : 'Start Scan'}
          </button>
        </div>
        <SettingsPanel />
      </section>
    </div>
  );
};
