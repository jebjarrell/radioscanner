import React from 'react';

import { useTelemetry } from '../contexts/TelemetryContext';

const STATUS_LABELS = [
  { key: 'SDR', predicate: (t: ReturnType<typeof useTelemetry>['telemetry']) => !!t?.health?.rtlTcp?.connected },
  { key: 'ADS-B', predicate: (t: ReturnType<typeof useTelemetry>['telemetry']) => !!t?.health?.dump1090?.healthy },
  { key: 'Kismet', predicate: (t: ReturnType<typeof useTelemetry>['telemetry']) => !!t?.health?.kismet?.ridEnabled },
  { key: 'GPS', predicate: (t: ReturnType<typeof useTelemetry>['telemetry']) => !!t?.health?.gps?.connected },
] as const;

export const TopBar: React.FC = () => {
  const { telemetry, connected } = useTelemetry();

  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <div className={`connection-pill ${connected ? 'connection-pill--online' : 'connection-pill--offline'}`}>
          {connected ? 'Telemetry Connected' : 'Telemetry Offline'}
        </div>
        <div className="service-status">
          {STATUS_LABELS.map(({ key, predicate }) => {
            const ok = predicate(telemetry);
            return (
              <div key={key} className="service-indicator">
                <span className={`led ${ok ? 'led-green' : 'led-red'}`} />
                <span className="service-indicator__label">{key}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="top-bar-actions">
        <button type="button" className="primary-button" disabled>
          Export CSV
        </button>
      </div>
    </header>
  );
};
