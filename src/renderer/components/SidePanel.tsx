import React, { useState } from 'react';

import { DashboardCounters } from './DashboardCounters';
import { AircraftList } from '../features/aircraft/AircraftList';

type Tab = 'dashboard' | 'aircraft' | 'drones' | 'rf';

export const SidePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('aircraft');

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
        >
          Drones
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
        {activeTab === 'drones' && <div className="side-panel-placeholder">Drone list (Phase 5)</div>}
        {activeTab === 'rf' && <div className="side-panel-placeholder">RF controls (Phase 6)</div>}
      </div>
    </div>
  );
};
