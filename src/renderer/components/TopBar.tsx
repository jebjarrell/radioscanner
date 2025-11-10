import React, { useState } from 'react';

import { useTelemetry } from '../contexts/TelemetryContext';

import { EnhancedSettingsPanel } from './EnhancedSettingsPanel';
import { ExportDialog } from './ExportDialog';

const STATUS_LABELS = [
  {
    key: 'SDR',
    predicate: (t: ReturnType<typeof useTelemetry>['telemetry']) => !!t?.health?.rtlTcp?.connected,
  },
  {
    key: 'ADS-B',
    predicate: (t: ReturnType<typeof useTelemetry>['telemetry']) => !!t?.health?.dump1090?.healthy,
  },
  {
    key: 'Kismet',
    predicate: (t: ReturnType<typeof useTelemetry>['telemetry']) => !!t?.health?.kismet?.ridEnabled,
  },
  {
    key: 'GPS',
    predicate: (t: ReturnType<typeof useTelemetry>['telemetry']) => !!t?.health?.gps?.connected,
  },
] as const;

export const TopBar: React.FC = () => {
  const { telemetry, connected } = useTelemetry();
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-left">
          <div
            className={`connection-pill ${connected ? 'connection-pill--online' : 'connection-pill--offline'}`}
          >
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
          <button type="button" className="primary-button" onClick={() => setSettingsOpen(true)}>
            ⚙ Settings
          </button>
          <button type="button" className="primary-button" onClick={() => setExportOpen(true)}>
            💾 Export CSV
          </button>
        </div>
      </header>
      <EnhancedSettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportDialog isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  );
};
