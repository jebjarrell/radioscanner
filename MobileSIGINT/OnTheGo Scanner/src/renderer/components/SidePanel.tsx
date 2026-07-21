import React, { useState } from 'react';

import { useTelemetry } from '../contexts/TelemetryContext';
import { AircraftList } from '../features/aircraft/AircraftList';
import { DroneList } from '../features/drone/DroneList';
import { RfPanel } from '../features/rf/RfPanel';

import { DashboardCounters } from './DashboardCounters';

type Tab = 'dashboard' | 'aircraft' | 'drones' | 'rf';

export const SidePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('aircraft');
  const { telemetry } = useTelemetry();
  const ridAvailable = telemetry?.drone?.ridAvailable ?? true;

  return (
    <div className="side-panel">
      <div className="side-panel-tabs">
        <button
          type="button"
          className={`side-panel-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`side-panel-tab ${activeTab === 'aircraft' ? 'active' : ''}`}
          onClick={() => setActiveTab('aircraft')}
        >
          Aircraft
        </button>
        <button
          type="button"
          className={`side-panel-tab ${activeTab === 'drones' ? 'active' : ''}`}
          onClick={() => setActiveTab('drones')}
          disabled={!ridAvailable}
          title={ridAvailable ? 'View detected drones' : 'Remote ID not available (Kismet offline)'}
        >
          <span>Drones</span>
          {!ridAvailable && (
            <span className="side-panel-tab__badge" aria-hidden="true">
              ⚠
            </span>
          )}
        </button>
        <button
          type="button"
          className={`side-panel-tab ${activeTab === 'rf' ? 'active' : ''}`}
          onClick={() => setActiveTab('rf')}
        >
          RF Scan
        </button>
      </div>
      <div className="side-panel-content">
        {activeTab === 'dashboard' && <DashboardCounters />}
        {activeTab === 'aircraft' && <AircraftList />}
        {activeTab === 'drones' && <DroneList />}
        {activeTab === 'rf' && <RfPanel />}
      </div>
    </div>
  );
};
